from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load monorepo root `.env` when the API is started from `backend/` (cwd-only `.env` would miss it).
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent


def _dotenv_files() -> tuple[str, ...]:
    ordered = (_REPO_ROOT / ".env", _BACKEND_DIR / ".env")
    return tuple(str(p) for p in ordered if p.is_file())


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_dotenv_files(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: str = "development"
    log_level: str = "info"
    cors_origins: str = "http://localhost:3000"
    backend_public_url: str = "http://localhost:8000"

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    opbnb_rpc_url: str = "https://opbnb-testnet-rpc.bnbchain.org"
    em_agent_private_key: str = ""
    mock_usdc_address: str = ""
    em_escrow_address: str = ""
    # `forge inspect EMEscrow storageLayout` — totalUSDCCommitted at slot 3 for this repo's contract; proxies may differ.
    em_escrow_committed_storage_slot: int = Field(
        default=3,
        validation_alias=AliasChoices("EMESCROW_COMMITTED_STORAGE_SLOT"),
    )
    chain_id: int = 5611

    gemini_api_key: str = ""

    world_id_app_id: str = ""
    world_id_action: str = "register-executor"
    world_id_rp_id: str = ""
    world_id_orb_bounty_threshold_micros: int = 5_000_000
    world_id_accept_enforce: bool = True

    x402_facilitator_url: str = ""
    x402_enforce: bool = False

    greenfield_bucket: str = "em-evidence-testnet"
    greenfield_rpc_url: str = Field(
        default="",
        validation_alias=AliasChoices("GREENFIELD_RPC_URL", "GREENFIELD_RPC"),
    )
    greenfield_chain_id: int = Field(default=5600, validation_alias="GREENFIELD_CHAIN_ID")
    use_greenfield_upload: bool = Field(default=False, validation_alias="USE_GREENFIELD_UPLOAD")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
