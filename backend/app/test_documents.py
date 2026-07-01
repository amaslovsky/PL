from app.documents import REGISTRY, get_doc, is_supported, fallback_message


def test_mnda_is_supported() -> None:
    assert is_supported("mnda") is True


def test_cloud_service_unsupported() -> None:
    assert is_supported("cloud-service-agreement") is False


def test_unknown_id_unsupported() -> None:
    assert is_supported("nope") is False
    assert is_supported("") is False


def test_closest_match_resolves() -> None:
    for entry in REGISTRY.values():
        if entry.closest_match == entry.id:
            continue
        target = get_doc(entry.closest_match)
        assert target is not None, f"{entry.id} -> {entry.closest_match}"


def test_no_duplicate_ids() -> None:
    ids = [e.id for e in REGISTRY.values()]
    assert len(ids) == len(set(ids))


def test_registry_size_matches_catalog_unique_slugs() -> None:
    # catalog.json has 12 entries; the MNDA cover page is folded under the
    # MNDA slug, so the BE registry carries the 11 unique user-facing slugs.
    assert len(REGISTRY) == 11


def test_fallback_message_names_closest_match() -> None:
    msg = fallback_message("cloud-service-agreement")
    assert "Cloud Service Agreement" in msg
    assert "Mutual Non-Disclosure Agreement" in msg


def test_fallback_message_for_unknown_id_is_generic() -> None:
    msg = fallback_message("nope")
    assert "home page" in msg.lower() or "home" in msg.lower()
