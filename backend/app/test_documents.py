from app.documents import REGISTRY, get_doc, is_known


def test_known_id_resolves() -> None:
    assert is_known("mnda") is True
    assert is_known("cloud-service-agreement") is True
    assert is_known("ai-addendum") is True


def test_unknown_id_is_unknown() -> None:
    assert is_known("nope") is False
    assert is_known("") is False


def test_no_duplicate_ids() -> None:
    ids = [e.id for e in REGISTRY.values()]
    assert len(ids) == len(set(ids))


def test_registry_size_matches_catalog_unique_slugs() -> None:
    # catalog.json has 12 entries; the MNDA cover page is folded under the
    # MNDA slug, so the BE registry carries the 11 unique user-facing slugs.
    assert len(REGISTRY) == 11


def test_every_entry_has_display_name_and_description() -> None:
    # The LLM uses these to pick which document the user is asking for.
    for entry in REGISTRY.values():
        assert entry.display_name, f"{entry.id} has no display_name"
        assert entry.description, f"{entry.id} has no description"


def test_get_doc_returns_entry_for_known_id() -> None:
    entry = get_doc("mnda")
    assert entry is not None
    assert entry.id == "mnda"
    assert entry.display_name == "Mutual Non-Disclosure Agreement"