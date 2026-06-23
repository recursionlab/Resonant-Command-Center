#!/usr/bin/env python3
"""
Omnigent Indexer v2 — Memory-efficient SQLite FTS5 indexer.

Uses SQLite's built-in full-text search (FTS5) instead of ChromaDB's HNSW
to handle 10K+ documents without memory issues. FTS5 provides BM25-ranked
keyword search which is excellent for knowledge base retrieval.

Usage:
  python indexer_v2.py index              # Index all documents
  python indexer_v2.py index --folder obsidian  # Index one folder
  python indexer_v2.py query "what is torsion tau"  # Search
  python indexer_v2.py stats              # Show statistics
  python indexer_v2.py export-cmd-center # Export for Command Center
"""

import argparse
import hashlib
import json
import sqlite3
import sys
import time
from pathlib import Path
from datetime import datetime

# ── Configuration ──
ROOT = Path(__file__).parent
DB_PATH = ROOT / ".index" / "index_v2.db"

SOURCES = {
    "bookmarks_sorted": ROOT / "BOOKMARKS_SORTED",
    "obsidian": ROOT / "OBSIDIAN",
    "insight_farming": ROOT / "insight_farming",
    "github_singularity": ROOT / "GitHub" / "singularity_repo",
    "root_docs": ROOT,
}

SKIP_DIRS = {'.git', '.hermes', '.vite', '__pycache__', 'node_modules', '.index'}
SKIP_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz'}
CHUNK_SIZE = 1000  # characters — larger for FTS5 (it handles longer text better)
CHUNK_OVERLAP = 100

# ── Database ──

def get_db() -> sqlite3.Connection:
    """Get or create the SQLite database with FTS5."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")  # Better concurrency
    conn.execute("PRAGMA synchronous=NORMAL")  # Faster writes
    conn.execute("PRAGMA cache_size=-64000")  # 64MB cache
    
    # Create the FTS5 virtual table
    conn.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS documents USING fts5(
            content,
            source UNINDEXED,
            file UNINDEXED,
            chunk_index UNINDEXED,
            total_chunks UNINDEXED,
            filepath UNINDEXED,
            modified UNINDEXED,
            tokenize='porter unicode61'
        )
    """)
    
    # Create metadata table for tracking indexed files
    conn.execute("""
        CREATE TABLE IF NOT EXISTS file_meta (
            file_id TEXT PRIMARY KEY,
            source TEXT,
            filepath TEXT,
            total_chunks INTEGER,
            file_size INTEGER,
            modified TEXT,
            indexed_at TEXT
        )
    """)
    
    return conn

# ── Helpers ──

def file_id(path: Path) -> str:
    return hashlib.md5(str(path.relative_to(ROOT)).encode()).hexdigest()[:16]

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    if len(text) <= size:
        return [text] if text.strip() else []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += size - overlap
    return chunks

def should_skip(path: Path) -> bool:
    parts = path.parts
    for part in parts:
        if part in SKIP_DIRS:
            return True
    if path.suffix.lower() in SKIP_EXTS:
        return True
    try:
        if path.stat().st_size > 5 * 1024 * 1024:
            return True
    except OSError:
        return True
    return False

def collect_files() -> dict[str, list[Path]]:
    result = {}
    for name, path in SOURCES.items():
        if not path.exists():
            continue
        if name == "root_docs":
            files = [f for f in path.glob("*.md")]
        else:
            files = [f for f in path.rglob("*") if not should_skip(f)]
        result[name] = sorted(files)
    return result

# ── Commands ──

def cmd_index(filter_folder: str = None):
    conn = get_db()
    sources = {filter_folder: SOURCES[filter_folder]} if filter_folder else SOURCES
    if filter_folder and filter_folder not in SOURCES:
        print(f"[ERROR] Unknown folder: {filter_folder}")
        sys.exit(1)

    files_by_source = collect_files()
    total_files = sum(len(f) for f in files_by_source.values())
    total_chunks = 0
    skipped = 0
    errors = 0

    print(f"[INDEX] Processing {total_files:,} files from {len(files_by_source)} sources...")
    start_time = time.time()

    for source_name, files in files_by_source.items():
        source_chunks = 0
        for i, filepath in enumerate(files):
            try:
                content = filepath.read_text(encoding='utf-8', errors='ignore')
                if len(content.strip()) < 20:
                    skipped += 1
                    continue

                fid = file_id(filepath)
                
                # Check if already indexed
                existing = conn.execute(
                    "SELECT file_id FROM file_meta WHERE file_id = ?", (fid,)
                ).fetchone()
                if existing:
                    continue

                chunks = chunk_text(content)
                if not chunks:
                    skipped += 1
                    continue

                rel_path = str(filepath.relative_to(ROOT))
                mtime = datetime.fromtimestamp(filepath.stat().st_mtime).isoformat()
                now = datetime.now().isoformat()

                # Insert chunks
                conn.executemany(
                    """INSERT INTO documents (content, source, file, chunk_index, total_chunks, filepath, modified)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    [
                        (chunk, source_name, rel_path, j, len(chunks), rel_path, mtime)
                        for j, chunk in enumerate(chunks)
                    ]
                )

                # Insert metadata
                conn.execute(
                    """INSERT OR REPLACE INTO file_meta 
                       (file_id, source, filepath, total_chunks, file_size, modified, indexed_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (fid, source_name, rel_path, len(chunks), filepath.stat().st_size, mtime, now)
                )

                conn.commit()
                source_chunks += len(chunks)
                total_chunks += len(chunks)

            except Exception as e:
                errors += 1
                if errors <= 5:
                    print(f"  [WARN] {filepath}: {e}")

            if (i + 1) % 1000 == 0:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed
                conn.execute("PRAGMA optimize")  # Optimize periodically
                print(f"  [{source_name}] {i+1}/{len(files)} files ({rate:.0f}/s) | {total_chunks:,} chunks")

        elapsed = time.time() - start_time
        print(f"  [{source_name}] Done: {source_chunks:,} chunks from {len(files):,} files ({elapsed:.1f}s)")

    # Final optimize
    conn.execute("PRAGMA optimize")
    conn.close()

    total_time = time.time() - start_time
    print(f"\n[INDEX COMPLETE]")
    print(f"  Files processed: {total_files:,}")
    print(f"  Chunks indexed: {total_chunks:,}")
    print(f"  Skipped (empty): {skipped:,}")
    print(f"  Errors: {errors:,}")
    print(f"  Time: {total_time:.1f}s")

def cmd_query(args):
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    if count == 0:
        print("[QUERY] Index is empty. Run: python indexer_v2.py index")
        return

    # Use FTS5's BM25 ranking
    query = args.query
    results = conn.execute(
        """SELECT source, file, chunk_index, total_chunks, 
                  snippet(documents, 0, '[', ']', '...', 10) as snippet,
                  bm25(documents) as score
           FROM documents 
           WHERE documents MATCH ?
           ORDER BY bm25(documents)
           LIMIT ?""",
        (query, args.top_k)
    ).fetchall()

    print(f"[QUERY] \"{query}\" — {count:,} chunks in index, top {len(results)} results:\n")

    for i, (source, file, chunk_idx, total, snippet, score) in enumerate(results, 1):
        print(f"  [{i}] {source}/{file} (chunk {chunk_idx}/{total}) | BM25: {score:.2f}")
        print(f"      {snippet}")
        print()

    conn.close()

def cmd_stats(args):
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    file_count = conn.execute("SELECT COUNT(*) FROM file_meta").fetchone()[0]

    if count == 0:
        print("[STATS] Index is empty.")
        return

    print(f"[STATS] Omnigent Knowledge Index (v2)")
    print(f"  Total chunks: {count:,}")
    print(f"  Total files: {file_count:,}")
    if DB_PATH.exists():
        print(f"  Database size: {DB_PATH.stat().st_size / 1024 / 1024:.1f} MB")
    print()

    rows = conn.execute(
        """SELECT source, COUNT(*) as files, 
                  SUM(total_chunks) as chunks
           FROM file_meta GROUP BY source ORDER BY chunks DESC"""
    ).fetchall()

    print(f"  Per source:")
    for source, files, chunks in rows:
        print(f"    {source}: {chunks:,} chunks from {files:,} files")

    conn.close()

def cmd_export_cmd_center(args):
    """Export index summary for the Command Center."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    file_count = conn.execute("SELECT COUNT(*) FROM file_meta").fetchone()[0]

    if count == 0:
        print("[EXPORT] Index is empty.")
        return

    rows = conn.execute(
        """SELECT source, filepath, total_chunks, file_size, indexed_at 
           FROM file_meta ORDER BY source, filepath"""
    ).fetchall()

    manifest = {
        "indexed_at": datetime.now().isoformat(),
        "total_chunks": count,
        "total_files": file_count,
        "format": "fts5_sqlite",
        "sources": {},
        "files": [],
    }

    for source, filepath, chunks, size, indexed_at in rows:
        if source not in manifest["sources"]:
            manifest["sources"][source] = {"files": 0, "chunks": 0}
        manifest["sources"][source]["files"] += 1
        manifest["sources"][source]["chunks"] += chunks
        
        manifest["files"].append({
            "source": source,
            "path": filepath,
            "chunks": chunks,
            "size": size,
            "indexed_at": indexed_at,
        })

    out_path = ROOT / ".index" / "manifest_v2.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(manifest, indent=2))
    print(f"[EXPORT] Manifest saved to {out_path}")
    print(f"  {file_count:,} files, {count:,} chunks, {len(manifest['sources'])} sources")

    # Show sample files per source
    print(f"\n  Sample files per source:")
    for source, stats in manifest["sources"].items():
        sample = [f["path"] for f in manifest["files"] if f["source"] == source][:3]
        print(f"    {source}:")
        for s in sample:
            print(f"      - {s}")
        if stats["files"] > 3:
            print(f"      ... and {stats['files'] - 3} more")

    conn.close()

def cmd_reset(args):
    """Reset the index."""
    if DB_PATH.exists():
        DB_PATH.unlink()
    print("[RESET] Index cleared.")

# ── Main ──

def main():
    parser = argparse.ArgumentParser(description="Omnigent Knowledge Indexer v2 (FTS5)")
    subparsers = parser.add_subparsers(dest="command")

    idx = subparsers.add_parser("index", help="Index all documents")
    idx.add_argument("--folder", type=str, default=None, help="Index only one folder")

    q = subparsers.add_parser("query", help="Search the index")
    q.add_argument("query", type=str)
    q.add_argument("--top-k", type=int, default=5)

    subparsers.add_parser("stats", help="Show statistics")
    
    subparsers.add_parser("export-cmd-center", help="Export for Command Center")
    
    subparsers.add_parser("reset", help="Reset index")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "index":
        cmd_index(args.folder)
    elif args.command == "query":
        cmd_query(args)
    elif args.command == "stats":
        cmd_stats(args)
    elif args.command == "export-cmd-center":
        cmd_export_cmd_center(args)
    elif args.command == "reset":
        cmd_reset(args)

if __name__ == "__main__":
    main()
