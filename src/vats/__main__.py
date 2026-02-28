"""Allow running VATS as ``python -m vats``."""
from vats.cli import main

raise SystemExit(main())
