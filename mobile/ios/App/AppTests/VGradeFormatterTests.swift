import XCTest
@testable import App

final class VGradeFormatterTests: XCTestCase {

    func testFormatVGradeExtractsVGrade() {
        XCTAssertEqual(VGradeFormatter.formatVGrade("6a/V3"), "V3")
        XCTAssertEqual(VGradeFormatter.formatVGrade("6b/V4"), "V4")
        XCTAssertEqual(VGradeFormatter.formatVGrade("7a/V6"), "V6")
        XCTAssertEqual(VGradeFormatter.formatVGrade("5c/V2"), "V2")
    }

    func testFormatVGradeAddsPlusForMultipleFontGrades() {
        XCTAssertEqual(VGradeFormatter.formatVGrade("6a+/V3"), "V3+")
        XCTAssertEqual(VGradeFormatter.formatVGrade("6b+/V4"), "V4+")
        XCTAssertEqual(VGradeFormatter.formatVGrade("6c+/V5"), "V5+")
        XCTAssertEqual(VGradeFormatter.formatVGrade("7b+/V8"), "V8+")
    }

    func testFormatVGradeNoPlusForSingleFontGrade() {
        XCTAssertEqual(VGradeFormatter.formatVGrade("7a+/V7"), "V7")
        XCTAssertEqual(VGradeFormatter.formatVGrade("7c+/V10"), "V10")
        XCTAssertEqual(VGradeFormatter.formatVGrade("8a+/V12"), "V12")
        XCTAssertEqual(VGradeFormatter.formatVGrade("8b+/V14"), "V14")
        XCTAssertEqual(VGradeFormatter.formatVGrade("8c+/V16"), "V16")
    }

    func testFormatVGradeNoPlusWhenFontGradeHasNone() {
        XCTAssertEqual(VGradeFormatter.formatVGrade("6c/V5"), "V5")
        XCTAssertEqual(VGradeFormatter.formatVGrade("6a/V3"), "V3")
        XCTAssertEqual(VGradeFormatter.formatVGrade("7b/V8"), "V8")
    }

    func testFormatVGradeBareVGrade() {
        XCTAssertEqual(VGradeFormatter.formatVGrade("V3"), "V3")
        XCTAssertEqual(VGradeFormatter.formatVGrade("V10"), "V10")
        XCTAssertEqual(VGradeFormatter.formatVGrade("V0"), "V0")
    }

    func testFormatVGradeEmptyString() {
        XCTAssertEqual(VGradeFormatter.formatVGrade(""), "")
    }

    func testFormatVGradeNoVGradeFound() {
        XCTAssertEqual(VGradeFormatter.formatVGrade("6a"), "6a")
        XCTAssertEqual(VGradeFormatter.formatVGrade("unknown"), "unknown")
    }
}
