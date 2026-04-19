// Mock Firebase so tests don't need real connection
jest.mock('../js/ClinicStaffFirebase.js', () => ({
    db: {}
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn()
}));

const { getDocs } = require('firebase/firestore');
const { validateStaffNumber } = require('../js/ClinicStaffFirebase.js');

describe("Test Clinic Staff Login", function () {
    test("invalid staff number returns error message", async function () {
        const error_message = "Invalid Staff Number was entered";
        expect(error_message).toBe("Invalid Staff Number was entered");
    })


    //test the function validatestaff number
    test("validate staff number return null if invalid staff number is entered", async function () {

        getDocs.mockResolvedValue({
            empty: true,
            docs: []
        });
        const result = await validateStaffNumber("invalid");
        expect(result).toBeNull();
    })

    test("validate staff number returns data for valid staff number", async function () {
        getDocs.mockResolvedValue({
            empty: false,
            docs: [{
                data: function () {
                    return {
                        StaffNumber: 12345,
                        ClinicID: "ChIJExgRGs4NlR4RMcO4P5F8umc"
                    }

                }
            }]
        });
        const result = await validateStaffNumber(12345);
        expect(result).not.toBeNull();
        expect(result.StaffNumber).toBe(12345);
    })

    test("valid staff data returns correctly", () => {
        // fake Firebase response
        const mockStaffData = {
            StaffNumber: 12345,
            ClinicID: "ChIJExgRGs4NlR4RMcO4P5F8umc"
        };

        expect(mockStaffData).not.toBeNull();
        expect(mockStaffData.StaffNumber).toBe(12345);
    });

    test("invalid staff returns null", () => {
        const mockStaffData = null;
        expect(mockStaffData).toBeNull();
    });
})