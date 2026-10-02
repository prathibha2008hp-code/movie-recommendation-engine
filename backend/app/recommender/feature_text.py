import re

_CLEAN_RE = re.compile(r"[^a-z0-9 _]")


def normalise_text(text: str) -> str:
    """Apply the same normalization used by the recommendation feature corpus."""
    text = text.lower()
    text = _CLEAN_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()