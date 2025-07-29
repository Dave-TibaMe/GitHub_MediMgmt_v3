def check_drug_interactions(medications, user_profile):
    # 簡化範例，可自行串接醫學資料庫
    known_interactions = [
        ("Aspirin", "Warfarin"),
        ("Clopidogrel", "Omeprazole"),
        # ...擴充
    ]
    interaction_found = []
    med_names = [med['name'] for med in medications]
    for a, b in known_interactions:
        if a in med_names and b in med_names:
            interaction_found.append((a, b))
    # profile分析可根據 user_profile
    warnings = []
    if interaction_found:
        for pair in interaction_found:
            warnings.append(f"{pair[0]} 與 {pair[1]} 可能有交互作用")
    return {
        "interaction": bool(warnings),
        "warnings": warnings,
        "disclaimer": "僅供參考，實際用藥請諮詢醫師或藥師"
    }
