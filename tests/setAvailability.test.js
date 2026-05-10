
const {
   setAvailability,
   fetchAvailability,
   deleteAvailability
} = require("../Controllers/SetAvailabilityController");

//mocking the services of set availability
jest.mock("../services/SetAvailabilityService",function() {
    return {  
    SaveAvailability : jest.fn(),
    getAvailability: jest.fn(),
    removeAvailability: jest.fn()
    };
});

const {
    SaveAvailability,
    getAvailability,
    removeAvailability

} = require("../services/SetAvailabilityService");

//mock request and response of objects
describe("Set availability Controller",function(){
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        console.error.mockRestore();
    });
    let mockRes;

    beforeEach(() => {
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    describe("set Availability" ,  function(){

        it("should save availability with valid data e.g ,date,startTime,endTime",async function(){

            SaveAvailability.mockResolvedValue({ success: true });

            const mockReq = {
                body : {
                    dates: ["2026-04-27"],
                    startTime: "08:00",
                    endTime: "17:00",
                    available: "true"
                }
            };

            await setAvailability(mockReq,mockRes);
            expect(mockRes.json).toHaveBeenCalledWith({ success: true });

        })

        it("should return status 400 if missing dates",async function(){
             const mockReq = {
                body : {
                    startTime: "08:00",
                    endTime: "17:00",
                    available: "true"
                }
            };
             
            await setAvailability(mockReq,mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error :"Missing required fields"
            });
        })

        it("should return status 400 if missing startTime",async function(){
             const mockReq = {
                body : {
                    dates: ["2026-04-27"],
                    endTime: "17:00",
                    available: "true"
                }
            };
             
            await setAvailability(mockReq,mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
        })
    });
    describe("fetchAvailability" , function(){
         it("should return availability staff data  ",async function(){
            getAvailability.mockResolvedValue({
                 "2026-04-27": {
                    Available: "true",
                    startTime: "08:00",
                    endTime: "17:00"
                }
            });
            const mockReq = {params : {staffCode: "STF-330AFB"}};
            await fetchAvailability(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith({
                 availability: {
                   "2026-04-27": {
                    Available: "true",
                    startTime: "08:00",
                    endTime: "17:00"
                }
            }
            });
         });

        it("should return empty object if no availability set for that staff_uid",async function(){
                getAvailability.mockResolvedValue({});

                const mockReq = {params : {staffCode: "J96HrT5YN3VOAAzNGqEhpxj4vUx2"}};
                await fetchAvailability(mockReq, mockRes);
                expect(mockRes.json).toHaveBeenCalledWith({
                    availability: {}
                });
        });
        
       });
        describe("deleteAvailability" , function(){
            it("should delete availability staff data  if staff_uid exists,for specific date ",async function(){
                removeAvailability.mockResolvedValue({ success: true });
                  const mockReq = {
                        body : {
                            date: ["2026-04-27"],

                        }
                    };
            await deleteAvailability(mockReq,mockRes);
            expect(mockRes.json).toHaveBeenCalledWith({ success: true });
            });

            it("should not delete availability data set for that staff_uid number that is not found,shoudl return status 500",async function(){
                     removeAvailability.mockRejectedValue(
                        new Error("Staff member not found")
                     );

                      const mockReq = {
                        body : {
                            date: ["2026-04-27"],
                        }
                    };
                    await deleteAvailability(mockReq,mockRes);
                    expect(mockRes.status).toHaveBeenCalledWith(500);
                    expect(mockRes.json).toHaveBeenCalledWith({
                            error :"Staff member not found"
                        });
                        
            });
        
       });    
});

