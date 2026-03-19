import { describe, expect, it } from "vitest";
import { parseEdl } from "./edlParser";

describe("parseEdl", () => {
	it("parses a basic EDL with cuts", () => {
		const edl = `TITLE: Test Sequence
FCM: NON-DROP FRAME

001  AX       V     C        00:00:00:00 00:00:05:00 00:00:00:00 00:00:05:00
002  AX       V     C        00:00:08:00 00:00:15:00 00:00:05:00 00:00:12:00
003  AX       V     C        00:00:20:00 00:00:30:00 00:00:12:00 00:00:22:00
`;

		const result = parseEdl(edl);

		expect(result.editCount).toBe(3);
		expect(result.fps).toBe(30);
		// Gap between edit 1 (srcOut=5s) and edit 2 (srcIn=8s) → trim 5000-8000ms
		expect(result.trimRegions).toHaveLength(2);
		expect(result.trimRegions[0].startMs).toBe(5000);
		expect(result.trimRegions[0].endMs).toBe(8000);
		// Gap between edit 2 (srcOut=15s) and edit 3 (srcIn=20s) → trim 15000-20000ms
		expect(result.trimRegions[1].startMs).toBe(15000);
		expect(result.trimRegions[1].endMs).toBe(20000);
		expect(result.speedRegions).toHaveLength(0);
	});

	it("parses speed changes from M2 lines", () => {
		const edl = `TITLE: Speed Test
FCM: NON-DROP FRAME

001  AX       V     C        00:00:00:00 00:00:10:00 00:00:00:00 00:00:05:00
M2   AX       200.0                      00:00:00:00
`;

		const result = parseEdl(edl);

		expect(result.editCount).toBe(1);
		expect(result.speedRegions).toHaveLength(1);
		expect(result.speedRegions[0].speed).toBe(2);
		expect(result.speedRegions[0].startMs).toBe(0);
		expect(result.speedRegions[0].endMs).toBe(10000);
	});

	it("snaps 50% speed to 0.5x", () => {
		const edl = `TITLE: Half Speed
FCM: NON-DROP FRAME

001  AX       V     C        00:00:00:00 00:00:05:00 00:00:00:00 00:00:10:00
M2   AX       050.0                      00:00:00:00
`;

		const result = parseEdl(edl);
		expect(result.speedRegions).toHaveLength(1);
		expect(result.speedRegions[0].speed).toBe(0.5);
	});

	it("detects drop frame", () => {
		const edl = `TITLE: DF Test
FCM: DROP FRAME

001  AX       V     C        00:00:00;00 00:00:05;00 00:00:00;00 00:00:05;00
`;
		// Drop frame detection only (timecode parsing still uses : for simplicity)
		const result = parseEdl(edl);
		expect(result.fps).toBe(29.97);
	});

	it("returns empty for empty content", () => {
		const result = parseEdl("");
		expect(result.editCount).toBe(0);
		expect(result.trimRegions).toHaveLength(0);
		expect(result.speedRegions).toHaveLength(0);
	});

	it("generates sequential trim IDs", () => {
		const edl = `TITLE: IDs
FCM: NON-DROP FRAME

001  AX       V     C        00:00:00:00 00:00:02:00 00:00:00:00 00:00:02:00
002  AX       V     C        00:00:05:00 00:00:07:00 00:00:02:00 00:00:04:00
003  AX       V     C        00:00:10:00 00:00:12:00 00:00:04:00 00:00:06:00
`;
		const result = parseEdl(edl);
		expect(result.trimRegions[0].id).toBe("trim-1");
		expect(result.trimRegions[1].id).toBe("trim-2");
	});
});
