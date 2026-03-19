// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseFcpXml } from "./fcpXmlParser";

describe("parseFcpXml", () => {
	it("parses a basic FCP XML with cuts", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>Test</name>
    <rate><timebase>30</timebase></rate>
    <media>
      <video>
        <track>
          <clipitem id="clip-1">
            <rate><timebase>30</timebase></rate>
            <start>0</start>
            <end>150</end>
            <in>0</in>
            <out>150</out>
          </clipitem>
          <clipitem id="clip-2">
            <rate><timebase>30</timebase></rate>
            <start>150</start>
            <end>450</end>
            <in>240</in>
            <out>540</out>
          </clipitem>
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

		const result = parseFcpXml(xml);

		expect(result.clipCount).toBe(2);
		expect(result.timebase).toBe(30);
		// Gap: clip-1 out=150 (5000ms), clip-2 in=240 (8000ms) → trim 5000-8000
		expect(result.trimRegions).toHaveLength(1);
		expect(result.trimRegions[0].startMs).toBe(5000);
		expect(result.trimRegions[0].endMs).toBe(8000);
	});

	it("detects speed changes from source/timeline duration mismatch", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmeml version="4">
  <sequence>
    <rate><timebase>30</timebase></rate>
    <media>
      <video>
        <track>
          <clipitem id="clip-1">
            <rate><timebase>30</timebase></rate>
            <start>0</start>
            <end>150</end>
            <in>0</in>
            <out>300</out>
          </clipitem>
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

		const result = parseFcpXml(xml);
		// Source: 300 frames, Timeline: 150 frames → ratio 2x
		expect(result.speedRegions).toHaveLength(1);
		expect(result.speedRegions[0].speed).toBe(2);
	});

	it("returns empty for invalid XML", () => {
		const result = parseFcpXml("not xml at all");
		expect(result.clipCount).toBe(0);
		expect(result.trimRegions).toHaveLength(0);
	});

	it("returns empty for XML with no sequence", () => {
		const result = parseFcpXml(`<?xml version="1.0"?><root></root>`);
		expect(result.clipCount).toBe(0);
	});

	it("handles no gaps (contiguous source clips)", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xmeml version="4">
  <sequence>
    <rate><timebase>30</timebase></rate>
    <media>
      <video>
        <track>
          <clipitem id="clip-1">
            <rate><timebase>30</timebase></rate>
            <start>0</start>
            <end>150</end>
            <in>0</in>
            <out>150</out>
          </clipitem>
          <clipitem id="clip-2">
            <rate><timebase>30</timebase></rate>
            <start>150</start>
            <end>300</end>
            <in>150</in>
            <out>300</out>
          </clipitem>
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;

		const result = parseFcpXml(xml);
		expect(result.trimRegions).toHaveLength(0);
		expect(result.speedRegions).toHaveLength(0);
	});
});
