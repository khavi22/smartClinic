const axios = require("axios");
const { getClinics } = require("../Controllers/ClinicsController");

jest.mock("axios");

describe("getClinics", () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      query: {}
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  it("should fetch clinics by search name", async () => {
    req.query.search = "Rosebank";

    const mockData = {
      places: [
        {
          displayName: { text: "Rosebank Clinic" },
          formattedAddress: "123 Main Road",
          location: {
            latitude: -26.145,
            longitude: 28.041
          },
          id: "clinic-1"
        }
      ]
    };

    axios.post.mockResolvedValue({ data: mockData });

    await getClinics(req, res);

    expect(axios.post).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: "clinic named Rosebank"
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": "AIzaSyAKqDTfRFmKVJw2W3PQDGyIgcm_BVpeWBk",
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.id"
        }
      }
    );

    expect(res.json).toHaveBeenCalledWith(mockData);
  });

  it("should fetch clinics by latitude and longitude", async () => {
    req.query.lat = "-26.2041";
    req.query.lon = "28.0473";

    const mockData = {
      places: [
        {
          displayName: { text: "Nearby Clinic" },
          formattedAddress: "456 Street",
          location: {
            latitude: -26.2041,
            longitude: 28.0473
          },
          id: "clinic-2"
        }
      ]
    };

    axios.post.mockResolvedValue({ data: mockData });

    await getClinics(req, res);

    expect(axios.post).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: "clinic near -26.2041,28.0473"
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": "AIzaSyAKqDTfRFmKVJw2W3PQDGyIgcm_BVpeWBk",
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.id"
        }
      }
    );

    expect(res.json).toHaveBeenCalledWith(mockData);
  });

  it("should return 500 when axios fails", async () => {
    req.query.search = "Sandton";

    axios.post.mockRejectedValue(new Error("API failed"));

    await getClinics(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Error fetching clinics"
    });
  });
});