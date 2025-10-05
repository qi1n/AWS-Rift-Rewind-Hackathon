// apps/scripts/fetch.ts
import * as path from "path";
import * as fs from "fs/promises";
import * as dotenv from "dotenv";
import axios, { AxiosError } from "axios";

// 1) 明确加载 .env（当前脚本目录）
dotenv.config({ path: path.resolve(__dirname, ".env") });

// 2) 读取环境变量（缺了就报错，避免踩坑）
const API_KEY = process.env.RIOT_API_KEY;
const REGION = process.env.REGION || "europe"; // match-v5 使用 regional routing: americas | europe | asia | sea
const SUMMONER_NAME = process.env.SUMMONER_NAME || "Horoooo";
const TAG_LINE = process.env.TAG_LINE || "EUW";
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.resolve(__dirname, "data", "res");

if (!API_KEY) throw new Error("Missing RIOT_API_KEY in .env");
if (!REGION) throw new Error("Missing REGION in .env");

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/** 简单重试（处理 429/5xx） */
async function getWithRetry<T>(url: string, tries = 3): Promise<T> {
    for (let i = 0; i < tries; i++) {
        try {
            const res = await axios.get<T>(url, { timeout: 30000 });
            return res.data;
        } catch (e) {
            const err = e as AxiosError<any>;
            const status = err.response?.status;
            const retryAfter = Number(err.response?.headers?.["retry-after"]) || 2;
            if (status === 429 || (status && status >= 500)) {
                console.warn(`HTTP ${status}, retry in ${retryAfter}s... (${i + 1}/${tries})`);
                await sleep(retryAfter * 1000);
                continue;
            }
            throw err;
        }
    }
    throw new Error(`Failed after ${tries} retries: ${url}`);
}

async function ensureDirs() {
    const timelinesDir = path.join(OUTPUT_DIR, "timelines");
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.mkdir(timelinesDir, { recursive: true });
    return { timelinesDir };
}

async function main() {
    console.log("CWD =", process.cwd());
    console.log("Output dir =", OUTPUT_DIR);

    const { timelinesDir } = await ensureDirs();

    // 1) 取 PUUID
    const acctUrl =
        `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/` +
        `${encodeURIComponent(SUMMONER_NAME)}/${encodeURIComponent(TAG_LINE)}?api_key=${API_KEY}`;
    const account = await getWithRetry<{ puuid: string }>(acctUrl);
    const puuid = account.puuid;
    console.log(`✅ PUUID: ${puuid}`);

    // 2) 取最近 N 场的 matchId（可调 count，最多 100）
    const count = Number(process.env.MATCH_COUNT || 20);
    const idsUrl =
        `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}` +
        `/ids?start=0&count=${count}&api_key=${API_KEY}`;
    const matchIds = await getWithRetry<string[]>(idsUrl);
    console.log(`🎮 Found ${matchIds.length} matches`);

    // 3) 拉取每场 match + timeline，并保存
    const matches: any[] = [];
    for (const id of matchIds) {
        // match id
        const matchUrl = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${id}?api_key=${API_KEY}`;
        const match = await getWithRetry<any>(matchUrl);
        matches.push(match);
        console.log(`✓ match fetched: ${id}`);


        // timeline
        const timelineUrl = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${id}/timeline?api_key=${API_KEY}`;
        try {
            const timeline = await getWithRetry<any>(timelineUrl);
            const timelinePath = path.join(timelinesDir, `${id}.json`);
            await fs.writeFile(timelinePath, JSON.stringify(timeline, null, 2), "utf-8");
            console.log(`  ↳ timeline saved: ${timelinePath}`);
        } catch (e) {
            const err = e as AxiosError<any>;
            console.warn(`  ⚠ timeline failed for ${id}: ${err.response?.status} ${err.message}`);
        }

        // 适当休眠避免 429（根据你的速率限制适当加大）
        await sleep(150);
    }

    // 4) 保存 matches 汇总文件（文件名含召唤师名）
    const outFile = path.join(OUTPUT_DIR, `${SUMMONER_NAME}_matches.json`);
    await fs.writeFile(outFile, JSON.stringify(matches, null, 2), "utf-8");
    console.log(`💾 Saved matches: ${outFile}`);
}

main().catch(err => {
    console.error("❌ Error:", err?.response?.data || err);
    process.exit(1);
});
