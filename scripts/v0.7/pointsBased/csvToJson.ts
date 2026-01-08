// Simple script to convert a CSV file to a keyed JSON file.
// run it with: yarn tsx scripts/v0.7/pointsBased/csvToJson.ts

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, "points.csv");
const jsonPath = path.join(__dirname, "points.json");

const csv = fs.readFileSync(csvPath, "utf-8");
const lines = csv.trim().split("\n");

// Skip header line
const dataLines = lines.slice(1);

const result: Record<string, { points: number }> = {};

for (const line of dataLines) {
  const [user, pointsStr] = line.split(",");
  if (user && pointsStr) {
    result[user.trim()] = { points: parseInt(pointsStr.trim(), 10) };
  }
}

fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

console.log(`Converted ${Object.keys(result).length} entries to ${jsonPath}`);
