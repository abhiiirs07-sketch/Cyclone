import unittest
from database import SessionLocal, init_db, CycloneMetadata
from main import (
    get_cyclones,
    get_cyclone_details,
    get_districts,
    get_infrastructure,
    predict_forecast_track,
    predict_custom_track,
    get_cyclone_damage_assessment,
    get_pdf_report,
    CustomTrackInput
)

class TestGeoCycloneAPI(unittest.TestCase):
    def setUp(self):
        init_db()
        from seed_data import seed_database
        seed_database()
        self.db = SessionLocal()
        self.cyclone = self.db.query(CycloneMetadata).first()
        self.assertIsNotNone(self.cyclone, "Database must be seeded before running tests")

    def tearDown(self):
        self.db.close()

    def test_get_cyclones(self):
        """Test retrieving list of cyclones with and without filters."""
        # 1. Get all
        res = get_cyclones(db=self.db)
        self.assertGreater(len(res), 0)
        self.assertTrue(any(c.name == "Amphan" for c in res))

        # 2. Filter by Year
        res_2020 = get_cyclones(year=2020, db=self.db)
        self.assertTrue(all(c.year == 2020 for c in res_2020))

    def test_get_cyclone_details(self):
        """Test retrieving specific cyclone details and track points."""
        res = get_cyclone_details(cyclone_id=self.cyclone.id, db=self.db)
        self.assertIn("metadata", res)
        self.assertIn("track", res)
        self.assertGreater(len(res["track"]), 0)
        self.assertEqual(res["metadata"]["name"], self.cyclone.name)

    def test_get_districts(self):
        """Test retrieving district vulnerability metrics."""
        res = get_districts(db=self.db)
        self.assertGreater(len(res), 0)
        self.assertTrue(any(d.name == "Puri" for d in res))

    def test_get_infrastructure(self):
        """Test retrieving infrastructure assets."""
        res = get_infrastructure(db=self.db)
        self.assertGreater(len(res), 0)

    def test_cyclone_forecast(self):
        """Test invoking AI forecasting model for a storm."""
        res = predict_forecast_track(cyclone_id=self.cyclone.id, db=self.db)
        self.assertEqual(len(res), 4) # 12h, 24h, 36h, 48h points
        for pt in res:
            self.assertTrue(pt["is_forecast"])
            self.assertGreater(pt["confidence_radius"], 0)

    def test_custom_track_simulation(self):
        """Test posting a custom drawn track and retrieving forecasts & damage models."""
        custom_input = CustomTrackInput(
            points=[
                {"lat": 12.0, "lon": 88.0, "wind_speed": 35.0, "pressure": 1000.0, "timestamp": "2026-07-03T12:00:00Z"},
                {"lat": 13.5, "lon": 86.5, "wind_speed": 45.0, "pressure": 995.0, "timestamp": "2026-07-03T18:00:00Z"}
            ],
            month=10,
            basin="Bay of Bengal"
        )
        res = predict_custom_track(input_data=custom_input, db=self.db)
        self.assertIn("forecast", res)
        self.assertIn("vulnerability", res)
        self.assertIn("damage", res)
        self.assertEqual(len(res["forecast"]), 4)

    def test_damage_assessment_gis(self):
        """Test generating spatial buffering and AHP overlay results."""
        res = get_cyclone_damage_assessment(cyclone_id=self.cyclone.id, db=self.db)
        self.assertIn("vulnerability", res)
        self.assertIn("damage", res)
        self.assertIn("geojson", res)
        self.assertEqual(res["geojson"]["type"], "FeatureCollection")

    def test_pdf_report_export(self):
        """Test generating and exporting printable PDF reports."""
        res = get_pdf_report(cyclone_id=self.cyclone.id, db=self.db)
        # Verify it returns a FileResponse and points to a valid PDF path
        self.assertIsNotNone(res.path)
        self.assertTrue(res.path.endswith(".pdf"))
        self.assertTrue(res.path.startswith("./temp_reports/"))

if __name__ == "__main__":
    unittest.main()
