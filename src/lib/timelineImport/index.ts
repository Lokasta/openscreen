import type { SpeedRegion, TrimRegion } from "@/components/video-editor/types";
import { parseEdl } from "./edlParser";
import { parseFcpXml } from "./fcpXmlParser";

export type TimelineFormat = "edl" | "fcpxml";

export interface TimelineImportResult {
	trimRegions: TrimRegion[];
	speedRegions: SpeedRegion[];
	format: TimelineFormat;
	clipCount: number;
	sourceVideoPath: string | null;
}

function detectFormat(content: string, fileName: string): TimelineFormat | null {
	const ext = fileName.toLowerCase().split(".").pop();

	if (ext === "edl") return "edl";
	if (ext === "xml" || ext === "fcpxml") return "fcpxml";

	// Try content-based detection
	if (
		content.trimStart().startsWith("<?xml") ||
		content.includes("<xmeml") ||
		content.includes("<fcpxml")
	) {
		return "fcpxml";
	}
	if (/^TITLE:/m.test(content) || /^\d{3}\s+\S+\s+\S+\s+\S/m.test(content)) {
		return "edl";
	}

	return null;
}

export function importTimeline(content: string, fileName: string): TimelineImportResult | null {
	const format = detectFormat(content, fileName);
	if (!format) return null;

	if (format === "edl") {
		const result = parseEdl(content);
		return {
			trimRegions: result.trimRegions,
			speedRegions: result.speedRegions,
			format: "edl",
			clipCount: result.editCount,
			sourceVideoPath: null,
		};
	}

	const result = parseFcpXml(content);
	return {
		trimRegions: result.trimRegions,
		speedRegions: result.speedRegions,
		format: "fcpxml",
		clipCount: result.clipCount,
		sourceVideoPath: result.sourceVideoPath,
	};
}

export type { EdlImportResult } from "./edlParser";
export { parseEdl } from "./edlParser";
export type { FcpXmlImportResult } from "./fcpXmlParser";
export { parseFcpXml } from "./fcpXmlParser";
