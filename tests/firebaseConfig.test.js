const originalEnv = process.env;

function loadFirebaseConfig({
    apps = [],
    credentialsJson,
    nodeEnv = "test",
} = {}) {
    jest.resetModules();

    process.env = {
        ...originalEnv,
        NODE_ENV: nodeEnv,
    };

    if (credentialsJson === undefined) {
        delete process.env.FIREBASE_CREDENTIALS_JSON;
    } else {
        process.env.FIREBASE_CREDENTIALS_JSON = credentialsJson;
    }

    const adminMock = {
        apps,
        initializeApp: jest.fn(),
        credential: {
            cert: jest.fn((serviceAccount) => ({
                type: "cert",
                serviceAccount,
            })),
        },
        firestore: jest.fn(() => ({ id: "db" })),
    };

    jest.doMock("firebase-admin", () => adminMock);

    const config = require("../services/config/firebase");

    return { adminMock, config };
}

describe("firebase config", () => {
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.dontMock("firebase-admin");
        jest.resetModules();
        process.env = originalEnv;
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it("uses an existing initialized app without initializing again", () => {
        const { adminMock, config } = loadFirebaseConfig({
            apps: [{ name: "existing" }],
            credentialsJson: JSON.stringify({ project_id: "already-on" }),
        });

        expect(adminMock.initializeApp).not.toHaveBeenCalled();
        expect(adminMock.firestore).toHaveBeenCalled();
        expect(config.db).toEqual({ id: "db" });
    });

    it("initializes from Firebase credentials JSON", () => {
        const serviceAccount = {
            project_id: "smart-clinic",
            client_email: "firebase@example.com",
            private_key: "key",
        };

        const { adminMock } = loadFirebaseConfig({
            credentialsJson: JSON.stringify(serviceAccount),
        });

        expect(adminMock.credential.cert).toHaveBeenCalledWith(serviceAccount);
        expect(adminMock.initializeApp).toHaveBeenCalledWith({
            credential: {
                type: "cert",
                serviceAccount,
            },
        });
    });

    it("cleans extra wrapping quotes around credentials JSON", () => {
        const serviceAccount = {
            project_id: "smart-clinic",
            client_email: "firebase@example.com",
            private_key: "key",
        };
        const wrappedJson = `"${JSON.stringify(serviceAccount).replace(/"/g, '\\"')}"`;

        const { adminMock } = loadFirebaseConfig({
            credentialsJson: wrappedJson,
        });

        expect(adminMock.credential.cert).toHaveBeenCalledWith(serviceAccount);
    });

    it("throws when credentials JSON is invalid", () => {
        expect(() => loadFirebaseConfig({
            credentialsJson: "{bad-json",
        })).toThrow();
    });

    it("initializes a test project when credentials are missing in test mode", () => {
        const { adminMock } = loadFirebaseConfig();

        expect(adminMock.initializeApp).toHaveBeenCalledWith({
            projectId: "test-project",
        });
    });

    it("throws when credentials are missing outside test mode", () => {
        expect(() => loadFirebaseConfig({
            nodeEnv: "production",
        })).toThrow("Missing Firebase Credentials");
    });
});
