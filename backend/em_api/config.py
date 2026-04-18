import re
from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
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
    # Operator-only: `POST /api/v1/tasks/{id}/resolve-dispute` header `X-EM-RESOLVE-KEY`
    em_resolve_api_key: str = Field(default="", validation_alias=AliasChoices("EM_RESOLVE_API_KEY"))
    mock_usdc_address: str = ""
    em_escrow_address: str = ""
    # `forge inspect EMEscrow storageLayout` — totalUSDCCommitted at slot 3 for this repo's contract; proxies may differ.
    em_escrow_committed_storage_slot: int = Field(
        default=3,
        validation_alias=AliasChoices("EMESCROW_COMMITTED_STORAGE_SLOT"),
    )
    chain_id: int = 5611

    gemini_api_key: str = ""

    #: Model id for `POST .../draft-chat` (must support `generateContent`; list: `GET v1beta/models`).
    gemini_chat_model: str = Field(
        default="gemini-2.5-flash",
        validation_alias=AliasChoices("GEMINI_CHAT_MODEL"),
    )

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def _normalize_gemini_api_key(cls, v: object) -> str:
        """Strip quotes / zero-width chars often introduced when copying keys into .env."""
        if v is None:
            return ""
        s = str(v).strip().strip('"').strip("'")
        s = re.sub(r"[\u200b-\u200d\ufeff\u00a0]", "", s)
        return s.strip()

    world_id_app_id: str = ""
    world_id_action: str = "register-executor"
    world_id_rp_id: str = ""
    world_id_orb_bounty_threshold_micros: int = 5_000_000
    world_id_accept_enforce: bool = True

    #: Nonce lifetime for `POST /api/v1/executors/agent-challenge` (seconds).
    agent_executor_challenge_ttl_sec: int = Field(
        default=900,
        ge=60,
        le=86_400,
        validation_alias=AliasChoices("AGENT_EXECUTOR_CHALLENGE_TTL_SEC"),
    )

    x402_facilitator_url: str = ""
    x402_enforce: bool = False

    greenfield_bucket: str = "em-evidence-testnet"
    greenfield_rpc_url: str = Field(
        default="",
        validation_alias=AliasChoices("GREENFIELD_RPC_URL", "GREENFIELD_RPC"),
    )
    greenfield_chain_id: int = Field(default=5600, validation_alias="GREENFIELD_CHAIN_ID")
    use_greenfield_upload: bool = Field(default=False, validation_alias="USE_GREENFIELD_UPLOAD")

    # Split verifier / settlement / reputation workers (see agents/emagents).
    verify_completes_chain: bool = Field(
        default=True,
        validation_alias=AliasChoices("VERIFY_COMPLETES_CHAIN"),
        description="If false, POST /verify marks verified only; settlement worker calls release.",
    )
    requester_approval_before_verify: bool = Field(
        default=True,
        validation_alias=AliasChoices("REQUESTER_APPROVAL_BEFORE_VERIFY"),
        description="If true, submit → awaiting_requester_review until POST .../approve-evidence; verify requires submitted.",
    )
    settlement_poll_interval_sec: float = Field(
        default=5.0,
        validation_alias=AliasChoices("SETTLEMENT_POLL_INTERVAL_SEC"),
    )
    settlement_batch_limit: int = Field(default=20, validation_alias=AliasChoices("SETTLEMENT_BATCH_LIMIT"))
    verifier_poll_interval_sec: float = Field(
        default=10.0,
        validation_alias=AliasChoices("VERIFIER_POLL_INTERVAL_SEC"),
    )
    verifier_use_realtime: bool = Field(
        default=False,
        validation_alias=AliasChoices("VERIFIER_USE_REALTIME"),
        description="Uses async Supabase realtime (requires project Realtime enabled).",
    )
    reputation_poll_interval_sec: float = Field(
        default=5.0,
        validation_alias=AliasChoices("REPUTATION_POLL_INTERVAL_SEC"),
    )

    # IRC / demo agents
    irc_server: str = Field(default="127.0.0.1", validation_alias=AliasChoices("IRC_SERVER"))
    irc_port: int = Field(default=6697, validation_alias=AliasChoices("IRC_PORT"))
    irc_tls: bool = Field(default=False, validation_alias=AliasChoices("IRC_TLS"))
    irc_nickname: str = Field(default="em-relay", validation_alias=AliasChoices("IRC_NICKNAME"))
    irc_password: str = Field(default="", validation_alias=AliasChoices("IRC_PASSWORD"))
    irc_channels: str = Field(
        default="#em-announce,#em-tasks-a2a",
        validation_alias=AliasChoices("IRC_CHANNELS"),
    )
    demo_buyer_wallet: str = Field(default="", validation_alias=AliasChoices("DEMO_BUYER_WALLET"))
    demo_buyer_requester_erc8004_id: int = Field(
        default=0,
        validation_alias=AliasChoices("DEMO_BUYER_REQUESTER_ERC8004_ID"),
    )
    demo_executor_wallet: str = Field(default="", validation_alias=AliasChoices("DEMO_EXECUTOR_WALLET"))
    demo_executor_erc8004_id: int = Field(
        default=0,
        validation_alias=AliasChoices("DEMO_EXECUTOR_ERC8004_ID"),
    )
    robot_lat: float = Field(default=37.7749, validation_alias=AliasChoices("ROBOT_LAT"))
    robot_lng: float = Field(default=-122.4194, validation_alias=AliasChoices("ROBOT_LNG"))
    robot_max_distance_m: float = Field(
        default=2000.0,
        validation_alias=AliasChoices("ROBOT_MAX_DISTANCE_M"),
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
