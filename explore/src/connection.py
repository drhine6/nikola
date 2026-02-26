import os
from pathlib import Path
from dotenv import load_dotenv
from espn_api.basketball import League

# Load .env from the repo root (two levels up from this file)
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_path)


def get_league() -> League:
    """Return an authenticated ESPN Fantasy Basketball League instance."""
    league_id = int(os.environ["LEAGUE_ID"])
    year = int(os.environ["LEAGUE_YEAR"])
    espn_s2 = os.environ["ESPN_S2"]
    swid = os.environ["SWID"]
    return League(league_id=league_id, year=year, espn_s2=espn_s2, swid=swid)
