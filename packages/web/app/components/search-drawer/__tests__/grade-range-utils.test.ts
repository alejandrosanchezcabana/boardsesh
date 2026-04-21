import { describe, it, expect } from "vite-plus/test";
import { buildGradeRangeUpdate } from "../grade-range-utils";

describe("buildGradeRangeUpdate", () => {
  // difficulty_id reference: 10 = 4a/V0, 16 = 5c/V3, 20 = 6b+/V5, 24 = 7a+/V7

  describe("setting min grade", () => {
    it("returns only minGrade when max is unset", () => {
      expect(buildGradeRangeUpdate("min", 20, undefined, undefined)).toEqual({
        minGrade: 20,
      });
    });

    it("returns only minGrade when new min is below current max", () => {
      expect(buildGradeRangeUpdate("min", 16, undefined, 24)).toEqual({
        minGrade: 16,
      });
    });

    it("returns only minGrade when new min equals current max", () => {
      expect(buildGradeRangeUpdate("min", 20, undefined, 20)).toEqual({
        minGrade: 20,
      });
    });

    it("auto-adjusts maxGrade when new min exceeds current max", () => {
      expect(buildGradeRangeUpdate("min", 24, undefined, 16)).toEqual({
        minGrade: 24,
        maxGrade: 24,
      });
    });

    it("clears minGrade without affecting max when set to undefined", () => {
      expect(buildGradeRangeUpdate("min", undefined, 20, 24)).toEqual({
        minGrade: undefined,
      });
    });

    it("does not auto-adjust when clearing min to 0", () => {
      expect(buildGradeRangeUpdate("min", 0, 20, 16)).toEqual({
        minGrade: 0,
      });
    });
  });

  describe("setting max grade", () => {
    it("returns only maxGrade when min is unset", () => {
      expect(buildGradeRangeUpdate("max", 20, undefined, undefined)).toEqual({
        maxGrade: 20,
      });
    });

    it("returns only maxGrade when new max is above current min", () => {
      expect(buildGradeRangeUpdate("max", 24, 16, undefined)).toEqual({
        maxGrade: 24,
      });
    });

    it("returns only maxGrade when new max equals current min", () => {
      expect(buildGradeRangeUpdate("max", 20, 20, undefined)).toEqual({
        maxGrade: 20,
      });
    });

    it("auto-adjusts minGrade when new max is below current min", () => {
      expect(buildGradeRangeUpdate("max", 16, 24, undefined)).toEqual({
        maxGrade: 16,
        minGrade: 16,
      });
    });

    it("clears maxGrade without affecting min when set to undefined", () => {
      expect(buildGradeRangeUpdate("max", undefined, 16, 24)).toEqual({
        maxGrade: undefined,
      });
    });

    it("does not auto-adjust when clearing max to 0", () => {
      expect(buildGradeRangeUpdate("max", 0, 24, undefined)).toEqual({
        maxGrade: 0,
      });
    });
  });
});
