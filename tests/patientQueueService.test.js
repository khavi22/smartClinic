const mockCollection = jest.fn();

jest.mock("../services/config/firebase", () => ({
    db: {
        collection: mockCollection,
    },
    admin: {},
}));

const { getPatientQueueInfo } = require("../services/patientQueueService");

function queueDoc(data) {
    return {
        data: () => data,
        ref: {
            update: jest.fn().mockResolvedValue(),
        },
    };
}

function mockQueueFirestore({
    patientDocs,
    allQueueDocs,
    clinics = [{ id: "clinic1" }],
}) {
    const queueItemsCollection = {
        where: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
                empty: patientDocs.length === 0,
                docs: patientDocs,
            }),
        })),
        orderBy: jest.fn(() => ({
            get: jest.fn().mockResolvedValue({
                docs: allQueueDocs,
            }),
        })),
    };

    const clinicDocRef = {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                collection: jest.fn(() => queueItemsCollection),
            })),
        })),
    };

    mockCollection.mockImplementation((collectionName) => {
        if (collectionName === "clinics") {
            return {
                get: jest.fn().mockResolvedValue({
                    docs: clinics,
                }),
                doc: jest.fn(() => clinicDocRef),
            };
        }

        return {};
    });
}

describe("patientQueueService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("excludes missed, complete, and different-slot patients from queue position and wait calculations", async () => {
        const missedAhead = queueDoc({
            patientId: "missed-patient",
            status: "MISSED",
            serviceDuration: 60,
            appointmentTime: "00:00 - 01:00",
        });
        const completeAhead = queueDoc({
            patientId: "complete-patient",
            status: "COMPLETE",
            serviceDuration: 45,
            appointmentTime: "00:00 - 01:00",
        });
        const differentSlotAhead = queueDoc({
            patientId: "different-slot-patient",
            status: "WAITING",
            serviceDuration: 90,
            appointmentTime: "02:00 - 03:00",
        });
        const activeAhead = queueDoc({
            patientId: "active-ahead",
            status: "WAITING",
            serviceDuration: 15,
            timeSlot: "00:00 - 01:00",
        });
        const currentPatient = queueDoc({
            patientId: "patient1",
            patientName: "Patient One",
            clinicName: "Clinic A",
            clinicAddress: "123 Street",
            appointmentTime: "00:00 - 01:00",
            status: "WAITING",
            serviceDuration: 30,
        });

        mockQueueFirestore({
            patientDocs: [currentPatient],
            allQueueDocs: [
                missedAhead,
                completeAhead,
                differentSlotAhead,
                activeAhead,
                currentPatient,
            ],
        });

        const result = await getPatientQueueInfo("patient1");

        expect(result).toEqual(expect.objectContaining({
            patientName: "Patient One",
            position: 2,
            totalInQueue: 2,
            waitBeforeYou: 15,
            status: "WAITING",
        }));
        expect(currentPatient.ref.update).toHaveBeenCalledWith(expect.objectContaining({
            estimatedWaitTime: expect.any(Number),
        }));
    });

    it("returns null when the patient's queue item is complete or missed", async () => {
        mockQueueFirestore({
            patientDocs: [
                queueDoc({
                    patientId: "patient1",
                    status: "COMPLETE",
                    appointmentTime: "00:00 - 01:00",
                }),
            ],
            allQueueDocs: [],
        });

        await expect(getPatientQueueInfo("patient1")).resolves.toBeNull();
    });
});
