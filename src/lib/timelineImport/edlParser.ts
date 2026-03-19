import type { PlaybackSpeed, SpeedRegion, TrimRegion } from "@/components/video-editor/types";

interface EdlEdit {
	editNumber: number;
	srcIn: number; // ms
	srcOut: number; // ms
	recIn: number; // ms
	recOut: number; // ms
	speedPercent: number | null; // from M2 line, e.g. 50.0 = 0.5x
}

export interface EdlImportResult {
	trimRegions: TrimRegion[];
	speedRegions: SpeedRegion[];
	fps: number;
	editCount: number;
}

function parseTimecodeToMs(tc: string, fps: number): number {
	const parts = tc.split(":");
	if (parts.length !== 4) return 0;
	const [hh, mm, ss, ff] = parts.map(Number);
	if ([hh, mm, ss, ff].some((v) => !Number.isFinite(v))) return 0;
	return Math.round((hh * 3600 + mm * 60 + ss) * 1000 + (ff / fps) * 1000);
}

function detectFps(content: string): number {
	// Look for FCM line to determine if drop frame
	if (/FCM:\s*DROP\s*FRAME/i.test(content)) {
		return 29.97;
	}
	// Default to 30fps (most common for screen recordings)
	return 30;
}

const VALID_SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2];

function snapToValidSpeed(percent: number): PlaybackSpeed | null {
	const ratio = percent / 100;
	// Find closest valid speed
	let closest: PlaybackSpeed | null = null;
	let minDist = Infinity;
	for (const speed of VALID_SPEEDS) {
		const dist = Math.abs(ratio - speed);
		if (dist < minDist) {
			minDist = dist;
			closest = speed;
		}
	}
	// Only snap if within 10% tolerance
	if (closest !== null && minDist <= closest * 0.1) {
		return closest;
	}
	return null;
}

export function parseEdl(content: string): EdlImportResult {
	const fps = detectFps(content);
	const lines = content.split(/\r?\n/);
	const edits: EdlEdit[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		// Match edit event lines: 001  AX  V  C  00:00:00:00 00:00:05:10 00:00:00:00 00:00:05:10
		const editMatch = line.match(
			/^(\d{3})\s+\S+\s+\S+\s+\S+\s+(\d{2}:\d{2}:\d{2}:\d{2})\s+(\d{2}:\d{2}:\d{2}:\d{2})\s+(\d{2}:\d{2}:\d{2}:\d{2})\s+(\d{2}:\d{2}:\d{2}:\d{2})/,
		);

		if (!editMatch) continue;

		const edit: EdlEdit = {
			editNumber: Number(editMatch[1]),
			srcIn: parseTimecodeToMs(editMatch[2], fps),
			srcOut: parseTimecodeToMs(editMatch[3], fps),
			recIn: parseTimecodeToMs(editMatch[4], fps),
			recOut: parseTimecodeToMs(editMatch[5], fps),
			speedPercent: null,
		};

		// Look for M2 motion effect on next line
		if (i + 1 < lines.length) {
			const nextLine = lines[i + 1].trim();
			const m2Match = nextLine.match(/^M2\s+\S+\s+([\d.]+)/);
			if (m2Match) {
				edit.speedPercent = Number(m2Match[1]);
			}
		}

		edits.push(edit);
	}

	// Extract trim regions: gaps in source timeline between consecutive edits
	const trimRegions: TrimRegion[] = [];
	let trimId = 1;

	for (let i = 0; i < edits.length - 1; i++) {
		const currentEnd = edits[i].srcOut;
		const nextStart = edits[i + 1].srcIn;

		if (nextStart > currentEnd + 50) {
			// 50ms tolerance for rounding
			trimRegions.push({
				id: `trim-${trimId++}`,
				startMs: currentEnd,
				endMs: nextStart,
			});
		}
	}

	// Extract speed regions from M2 lines
	const speedRegions: SpeedRegion[] = [];
	let speedId = 1;

	for (const edit of edits) {
		if (edit.speedPercent !== null && edit.speedPercent !== 100) {
			const validSpeed = snapToValidSpeed(edit.speedPercent);
			if (validSpeed) {
				speedRegions.push({
					id: `speed-${speedId++}`,
					startMs: edit.srcIn,
					endMs: edit.srcOut,
					speed: validSpeed,
				});
			}
		}
	}

	return {
		trimRegions,
		speedRegions,
		fps,
		editCount: edits.length,
	};
}
