"""Measures FormPilot's accuracy, speed and error rate on labelled data.

    cd backend
    python eval/run_eval.py                 # field mapping + extraction
    python eval/run_eval.py --manual-seconds 20

Field mapping: every label in eval/form_labels.json has the concept it asks for (or null). For each
matcher we report
  accuracy     correct concept, counting "no match" as correct for non-profile labels
  wrong fills  labels mapped to the wrong concept: the costly error, since a wrong value gets filled in
  misses       profile labels left for the user to fill by hand
Extraction: field-level precision and recall on eval/documents.json, with rules alone and, when
GROQ_API_KEY is set, rules + LLM.

Note: the semantic thresholds in app/services/mapping.py were tuned on form_labels.json, so the hybrid
score here is optimistic. Add new forms to the file to measure on unseen labels.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent))
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

from app.config import get_settings  # noqa: E402
from app.services.embeddings import get_embedder  # noqa: E402
from app.services.extraction import extract_fields, llm_fields, merge_extractions  # noqa: E402
from app.services.llm import llm_available  # noqa: E402
from app.services.mapping import classify, classify_hybrid  # noqa: E402
from app.services.profile import normalize  # noqa: E402


def evaluate_mapping(name: str, matcher, rows: list[tuple[str, str | None]]) -> dict:
    correct = wrong = missed = 0
    started = time.perf_counter()
    for label, expected in rows:
        key = matcher(label)
        if key == expected:
            correct += 1
        elif key is None:
            missed += 1
        else:
            wrong += 1
    elapsed = (time.perf_counter() - started) * 1000 / len(rows)
    return {"matcher": name, "accuracy": correct / len(rows), "wrong": wrong, "missed": missed, "ms_per_label": elapsed}


def evaluate_extraction(use_llm: bool, documents: list[dict]) -> dict:
    tp = fp = fn = 0
    for doc in documents:
        text = "\n".join(doc["lines"])
        fields = extract_fields(text)
        if use_llm and (model := llm_fields(text)) is not None:
            fields = merge_extractions(fields, model, text)
        got = {f.key: normalize(f.value) for f in fields}
        want = {k: normalize(v) for k, v in doc["expected"].items()}
        tp += sum(1 for k, v in got.items() if want.get(k) == v)
        fp += sum(1 for k, v in got.items() if want.get(k) != v)
        fn += sum(1 for k in want if got.get(k) != want[k])
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {"pipeline": "rules + LLM" if use_llm else "rules only", "precision": precision, "recall": recall, "fields": tp + fn}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manual-seconds", type=float, default=25.0, help="Assumed time to type one field by hand.")
    args = parser.parse_args()

    labels = json.loads((ROOT / "form_labels.json").read_text(encoding="utf-8"))
    rows = [(label, expected) for form in labels["forms"].values() for label, expected in form]
    print(f"Embeddings: {get_embedder().name}   LLM: {get_settings().llm_model if llm_available() else 'off'}\n")

    print(f"## Field mapping ({len(rows)} labels from {len(labels['forms'])} forms)\n")
    print("| Matcher | Accuracy | Wrong fills | Misses | ms / label |")
    print("|---|---|---|---|---|")
    results = [
        evaluate_mapping("Lexical only", lambda l: classify(l)[0], rows),
        evaluate_mapping("Lexical + semantic embeddings", lambda l: classify_hybrid(l)[0], rows),
    ]
    for r in results:
        print(f"| {r['matcher']} | {r['accuracy']:.0%} | {r['wrong']} | {r['missed']} | {r['ms_per_label']:.1f} |")

    profile_labels = sum(1 for _, e in rows if e)
    best = results[-1]
    auto = profile_labels - best["missed"] - best["wrong"]
    saved = auto * args.manual_seconds / 60
    print(
        f"\nOf {profile_labels} labels that ask for a personal detail, {auto} are filled automatically. "
        f"At {args.manual_seconds:.0f} s per typed field (assumption), that saves ~{saved:.0f} min across these "
        f"{len(labels['forms'])} forms; the user still reviews every value before approving.\n"
    )

    documents = json.loads((ROOT / "documents.json").read_text(encoding="utf-8"))["documents"]
    print(f"## Extraction ({len(documents)} documents)\n")
    print("| Pipeline | Precision | Recall | Labelled fields |")
    print("|---|---|---|---|")
    runs = [False, True] if llm_available() else [False]
    for use_llm in runs:
        r = evaluate_extraction(use_llm, documents)
        print(f"| {r['pipeline']} | {r['precision']:.0%} | {r['recall']:.0%} | {r['fields']} |")
    if not llm_available():
        print("\nSet GROQ_API_KEY to also measure rules + LLM.")


if __name__ == "__main__":
    main()
