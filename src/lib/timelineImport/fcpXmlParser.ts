import type { PlaybackSpeed, SpeedRegion, TrimRegion } from "@/components/video-editor/types";

interface FcpClipItem {
	inFrame: number;
	outFrame: number;
	startFrame: number;
	endFrame: number;
	timebase: number;
}

export interface FcpXmlImportResult {
	trimRegions: TrimRegion[];
	speedRegions: SpeedRegion[];
	timebase: number;
	clipCount: number;
	sourceVideoPath: string | null;
}

const VALID_SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2];

function snapToValidSpeed(ratio: number): PlaybackSpeed | null {
	let closest: PlaybackSpeed | null = null;
	let minDist = Infinity;
	for (const speed of VALID_SPEEDS) {
		const dist = Math.abs(ratio - speed);
		if (dist < minDist) {
			minDist = dist;
			closest = speed;
		}
	}
	if (closest !== null && minDist <= closest * 0.1) {
		return closest;
	}
	return null;
}

function frameToMs(frame: number, timebase: number): number {
	if (timebase <= 0) return 0;
	return Math.round((frame / timebase) * 1000);
}

function getElementNumber(parent: Element, tagName: string): number {
	const el = parent.querySelector(tagName);
	if (!el?.textContent) return 0;
	const value = Number(el.textContent.trim());
	return Number.isFinite(value) ? value : 0;
}

function getTimebase(element: Element): number {
	const rateEl = element.querySelector("rate");
	if (!rateEl) return 30;
	return getElementNumber(rateEl, "timebase") || 30;
}

export function parseFcpXml(xmlContent: string): FcpXmlImportResult {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xmlContent, "text/xml");

	const emptyResult: FcpXmlImportResult = {
		trimRegions: [],
		speedRegions: [],
		timebase: 30,
		clipCount: 0,
		sourceVideoPath: null,
	};

	// Check for parse errors
	const parseError = doc.querySelector("parsererror");
	if (parseError) {
		return emptyResult;
	}

	// Find the sequence — FCP 7 XML uses <xmeml><sequence>
	const sequence = doc.querySelector("sequence");
	if (!sequence) {
		return emptyResult;
	}

	const sequenceTimebase = getTimebase(sequence);

	// Find all clipitems in video tracks
	const clipItems = sequence.querySelectorAll("media > video > track > clipitem");
	if (clipItems.length === 0) {
		return { ...emptyResult, timebase: sequenceTimebase };
	}

	// Extract source video path from the first <file> element with a <pathurl>
	let sourceVideoPath: string | null = null;
	const fileEl = sequence.querySelector("media > video > track > clipitem > file > pathurl");
	if (fileEl?.textContent) {
		const rawUrl = fileEl.textContent.trim();
		try {
			sourceVideoPath = decodeURIComponent(new URL(rawUrl).pathname);
		} catch {
			sourceVideoPath = rawUrl.replace(/^file:\/\//, "");
		}
	}

	const clips: FcpClipItem[] = [];

	for (const clipEl of clipItems) {
		const clipTimebase = getTimebase(clipEl) || sequenceTimebase;
		const inFrame = getElementNumber(clipEl, "in");
		const outFrame = getElementNumber(clipEl, "out");
		const startFrame = getElementNumber(clipEl, "start");
		const endFrame = getElementNumber(clipEl, "end");

		if (outFrame > inFrame) {
			clips.push({
				inFrame,
				outFrame,
				startFrame,
				endFrame,
				timebase: clipTimebase,
			});
		}
	}

	// Sort clips by their position on the timeline
	clips.sort((a, b) => a.startFrame - b.startFrame);

	// Extract trim regions: gaps in source timeline between consecutive clips
	const trimRegions: TrimRegion[] = [];
	let trimId = 1;

	for (let i = 0; i < clips.length - 1; i++) {
		const currentClip = clips[i];
		const nextClip = clips[i + 1];

		const currentSrcEndMs = frameToMs(currentClip.outFrame, currentClip.timebase);
		const nextSrcStartMs = frameToMs(nextClip.inFrame, nextClip.timebase);

		if (nextSrcStartMs > currentSrcEndMs + 50) {
			trimRegions.push({
				id: `trim-${trimId++}`,
				startMs: currentSrcEndMs,
				endMs: nextSrcStartMs,
			});
		}
	}

	// Extract speed regions: compare source duration vs timeline duration per clip
	const speedRegions: SpeedRegion[] = [];
	let speedId = 1;

	for (const clip of clips) {
		const srcDuration = clip.outFrame - clip.inFrame;
		const tlDuration = clip.endFrame - clip.startFrame;

		if (srcDuration > 0 && tlDuration > 0 && srcDuration !== tlDuration) {
			const ratio = srcDuration / tlDuration;
			const validSpeed = snapToValidSpeed(ratio);
			if (validSpeed) {
				speedRegions.push({
					id: `speed-${speedId++}`,
					startMs: frameToMs(clip.inFrame, clip.timebase),
					endMs: frameToMs(clip.outFrame, clip.timebase),
					speed: validSpeed,
				});
			}
		}
	}

	return {
		trimRegions,
		speedRegions,
		timebase: sequenceTimebase,
		clipCount: clips.length,
		sourceVideoPath,
	};
}
