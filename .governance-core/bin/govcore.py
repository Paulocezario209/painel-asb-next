#!/usr/bin/env python3
"""govcore — distribuicao versionada do ASB Governance Core.

UMA implementacao para as 4 operacoes (empacotar, instalar, gerar lock, verificar):
duas copias da funcao de hash divergiriam e a verificacao de drift viraria mentira.

    govcore.py pack    [--source DIR] [--json]
    govcore.py install --target DIR [--source DIR] [--upgrade] [--dry-run]
    govcore.py verify  --target DIR [--source DIR]

MODELO
  fonte unica   governance-core/ no repo canonico
  distribuicao  VENDORIZADA (copia gerada, nunca editada a mao) — sem submodule
  no satelite   .governance-core/ + .governance-lock
  integridade   sha256 por arquivo + hash de arvore; drift = falha

INVARIANTES
  - stdlib apenas. SEM rede, SEM curl, SEM dependencia externa. Funciona offline
    a partir de qualquer checkout ja disponivel (Mac, CI, sandbox Web, repo novo).
  - copia SOMENTE o que o MANIFEST declara como core; nunca toca conteudo repo-local.
  - recusa publicar/instalar se algum arquivo casar com o padrao de segredo do
    Guardiao 1 (fonte unica: hooks/preflight-gate.sh do proprio core).
  - MANIFEST e conteudo do disco tem de bater nos DOIS sentidos (nada faltando,
    nada a mais); divergencia = falha.
  - verify NAO altera nada. install so sobrescreve versao diferente com --upgrade.

EXIT  0 ok · 1 drift/divergencia · 2 segredo · 3 uso/IO
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

LOCK_NAME = ".governance-lock"
VENDOR_DIR = ".governance-core"
IMPLICIT = ("VERSION", "MANIFEST.json")          # membros do core fora dos arrays do MANIFEST
LOCK_VERSION = 1
WARNING = "VENDORIZADO — gerado por govcore. NAO editar aqui; edite a fonte unica e reinstale."


def die(code, msg):
    print(f"govcore: {msg}", file=sys.stderr)
    sys.exit(code)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def tree_hash(files):
    """Hash deterministico da arvore: caminho + hash, em ordem estavel."""
    h = hashlib.sha256()
    for rel in sorted(files):
        h.update(rel.encode("utf-8"))
        h.update(b"\0")
        h.update(files[rel].encode("ascii"))
        h.update(b"\n")
    return h.hexdigest()


# ---------------------------------------------------------------- fonte / manifesto
def resolve_source(arg):
    """Aceita: o proprio core, um repo que o contenha, ou nada (deduz do proprio script)."""
    cands = []
    if arg:
        cands += [os.path.abspath(arg), os.path.join(os.path.abspath(arg), "governance-core")]
    else:
        here = os.path.dirname(os.path.abspath(__file__))          # <core>/bin
        cands.append(os.path.dirname(here))                         # <core>
    for c in cands:
        if os.path.isfile(os.path.join(c, "MANIFEST.json")) and os.path.isfile(os.path.join(c, "VERSION")):
            return c
    die(3, f"fonte do core nao encontrada (procurei em: {', '.join(cands)})")


def load_manifest(source):
    try:
        with open(os.path.join(source, "MANIFEST.json"), encoding="utf-8") as f:
            man = json.load(f)
        with open(os.path.join(source, "VERSION"), encoding="utf-8") as f:
            version = f.read().strip()
    except (OSError, ValueError) as e:
        die(3, f"MANIFEST/VERSION ilegivel: {e}")
    if man.get("core_version") != version:
        die(1, f"MANIFEST.core_version ({man.get('core_version')}) != VERSION ({version})")
    return man, version


def declared_files(man):
    rel = set(IMPLICIT)
    for group in (man.get("core") or {}).values():
        for item in group:
            p = item.get("path")
            if p:
                rel.add(p)
    return rel


def actual_files(source):
    found = set()
    for root, dirs, names in os.walk(source):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", ".git")]
        for n in names:
            if n.endswith(".pyc") or n == ".DS_Store":
                continue
            found.add(os.path.relpath(os.path.join(root, n), source))
    return found


def check_manifest_vs_disk(source, man):
    """Requisito 6: MANIFEST e conteudo tem de bater nos DOIS sentidos."""
    declared, actual = declared_files(man), actual_files(source)
    missing = sorted(declared - actual)
    extra = sorted(actual - declared)
    if missing:
        die(1, "MANIFEST declara arquivo(s) ausente(s) do disco: " + ", ".join(missing))
    if extra:
        die(1, "arquivo(s) no core nao declarado(s) no MANIFEST: " + ", ".join(extra)
               + " — declare em core.* ou remova")
    return sorted(declared)


# ---------------------------------------------------------------- anti-segredo
def secret_pattern(source):
    """FONTE UNICA do padrao: o Guardiao 1 do proprio core. Fail-closed se ausente."""
    guard = os.path.join(source, "hooks", "preflight-gate.sh")
    pat = None
    try:
        with open(guard, encoding="utf-8") as f:
            for line in f:
                m = re.match(r"^SECRET_RE='(.*)'\s*$", line.rstrip("\n"))
                if m:
                    pat = m.group(1)
                    break
    except OSError:
        pat = None
    if pat is None:
        die(2, "SECRET_RE do Guardiao 1 nao encontrado no core — fail-closed")
    try:
        rx = re.compile(pat)
    except re.error as e:
        die(2, f"regex do Guardiao 1 incompativel com Python ({e}) — fail-closed")
    # self-test: fixtures montados por concatenacao (o literal nao aparece na fonte)
    for name, fx in (("JWT", "eyJ" + "A" * 22 + "." + "B" * 12),
                     ("sk-", "sk" + "-" + "A" * 24),
                     ("ghp_", "ghp" + "_" + "A" * 36)):
        if not rx.search(fx):
            die(2, f"self-test do anti-segredo falhou no fixture {name} — fail-closed")
    return rx


# O guardiao E o catalogo de padroes: seus comentarios e definicoes de regex descrevem a FORMA
# de uma credencial e por isso se auto-acusam. Exceccao estreita e DECLARADA: apenas nesse
# arquivo pulam-se comentarios e linhas `NOME_RE='...'`; o codigo executavel segue escaneado.
GUARD_REL = os.path.join("hooks", "preflight-gate.sh")
CATALOG_LINE = re.compile(r"^\s*#|^[A-Z_]+_RE='")


def scan_secrets(source, rels, rx):
    for rel in rels:
        p = os.path.join(source, rel)
        is_guard = rel == GUARD_REL
        try:
            with open(p, encoding="utf-8", errors="replace") as f:
                for lineno, line in enumerate(f, 1):
                    if is_guard and CATALOG_LINE.match(line):
                        continue
                    if rx.search(line):
                        die(2, f"SEGREDO detectado em {rel}:{lineno} — recusado "
                               f"(envie nome de variavel, nunca valor)")
        except OSError as e:
            die(3, f"ERRO IO em {rel}: {e}")


# ---------------------------------------------------------------- pack
def build_payload(source, man, version):
    rels = check_manifest_vs_disk(source, man)
    scan_secrets(source, rels, secret_pattern(source))
    files = {rel: sha256_file(os.path.join(source, rel)) for rel in rels}
    return {
        "lock_version": LOCK_VERSION,
        "core_name": man.get("name", "asb-governance-core"),
        "core_version": version,
        "source_commit": git_sha(source),
        "content_hash": tree_hash(files),
        "files": files,
        "warning": WARNING,
    }


def git_sha(source):
    try:
        out = subprocess.run(["git", "-C", source, "rev-parse", "HEAD"],
                             capture_output=True, text=True, timeout=10)
        return out.stdout.strip() if out.returncode == 0 and out.stdout.strip() else "UNKNOWN"
    except (OSError, subprocess.SubprocessError):
        return "UNKNOWN"


def cmd_pack(args):
    source = resolve_source(args.source)
    man, version = load_manifest(source)
    payload = build_payload(source, man, version)
    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(f"core        : {payload['core_name']} v{payload['core_version']}")
        print(f"commit      : {payload['source_commit']}")
        print(f"content_hash: {payload['content_hash']}")
        print(f"arquivos    : {len(payload['files'])}")
        print("OK: pacote coerente (MANIFEST x disco, sem segredo)")
    return 0


# ---------------------------------------------------------------- install
def read_lock(target):
    p = os.path.join(target, LOCK_NAME)
    if not os.path.isfile(p):
        return None
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        die(1, f"{LOCK_NAME} ilegivel/invalido: {e}")


def vendor_problems(target, lock):
    """Estado REAL do vendorizado x lock. Uma implementacao so — verify e install usam esta."""
    vendor = os.path.join(target, VENDOR_DIR)
    if not os.path.isdir(vendor):
        return [f"AUSENTE   {VENDOR_DIR}/ (lock existe, instalacao corrompida)"]
    expected = lock.get("files") or {}
    problems = []
    for rel, want in expected.items():
        p = os.path.join(vendor, rel)
        if not os.path.isfile(p):
            problems.append(f"AUSENTE   {rel}")
        elif sha256_file(p) != want:
            problems.append(f"ALTERADO  {rel}")
    for rel in sorted(actual_files(vendor) - set(expected)):
        problems.append(f"EXTRA     {rel}")
    return problems


def cmd_install(args):
    source = resolve_source(args.source)
    target = os.path.abspath(args.target)
    if not os.path.isdir(target):
        die(3, f"alvo inexistente: {target}")
    if os.path.abspath(os.path.dirname(source)) == target:
        die(3, "alvo e o proprio repo canonico — o core ja e a fonte aqui, nao se vendoriza nele")

    man, version = load_manifest(source)
    payload = build_payload(source, man, version)
    vendor = os.path.join(target, VENDOR_DIR)
    old = read_lock(target)

    if old:
        if old.get("content_hash") == payload["content_hash"]:
            # Mesma versao NAO basta: se o vendorizado sofreu edicao manual, reinstalar REPARA.
            drift = vendor_problems(target, old)
            if not drift:
                print(f"ja atualizado: {old['core_name']} v{old['core_version']} ({payload['content_hash'][:12]})")
                return 0
            if args.dry_run:
                print(f"[dry-run] repararia {len(drift)} problema(s) de drift em {VENDOR_DIR}/")
                return 0
            print(f"drift detectado ({len(drift)} problema(s)) — reinstalando para reparar")
        elif not args.upgrade:
            die(1, f"ja instalado v{old.get('core_version')} ({str(old.get('content_hash'))[:12]}) "
                   f"difere de v{version} ({payload['content_hash'][:12]}) — "
                   f"use --upgrade para trocar explicitamente")
    elif os.path.isdir(vendor) and os.listdir(vendor):
        die(1, f"{VENDOR_DIR}/ existe sem {LOCK_NAME} — recuso sobrescrever conteudo nao rastreado")

    if args.dry_run:
        print(f"[dry-run] instalaria v{version} ({len(payload['files'])} arquivos) em {vendor}")
        print(f"[dry-run] {LOCK_NAME} -> content_hash {payload['content_hash'][:12]}")
        return 0

    if os.path.isdir(vendor):
        shutil.rmtree(vendor)                     # upgrade limpo: nunca deixa arquivo orfao
    for rel in payload["files"]:
        src, dst = os.path.join(source, rel), os.path.join(vendor, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        if os.access(src, os.X_OK):
            os.chmod(dst, 0o755)
    with open(os.path.join(target, LOCK_NAME), "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"instalado: {payload['core_name']} v{version} ({len(payload['files'])} arquivos) em {VENDOR_DIR}/")
    print(f"lock: {LOCK_NAME} · content_hash {payload['content_hash'][:12]} · commit {payload['source_commit'][:12]}")
    return 0


# ---------------------------------------------------------------- verify
def cmd_verify(args):
    target = os.path.abspath(args.target)
    lock = read_lock(target)
    if lock is None:
        die(1, f"{LOCK_NAME} ausente em {target} — core nao instalado")
    expected = lock.get("files") or {}
    problems = vendor_problems(target, lock)

    if problems:
        print(f"DRIFT em {VENDOR_DIR}/ ({len(problems)} problema(s)):")
        for p in problems:
            print("  " + p)
        print(f"O vendorizado e copia gerada. Corrija na FONTE e reinstale (install --upgrade).")
        return 1

    got = tree_hash({rel: expected[rel] for rel in expected})
    if got != lock.get("content_hash"):
        print(f"DRIFT: content_hash do lock nao confere ({got[:12]} != {str(lock.get('content_hash'))[:12]})")
        return 1

    print(f"OK: {lock.get('core_name')} v{lock.get('core_version')} integro "
          f"({len(expected)} arquivos, content_hash {got[:12]})")

    if args.source is not None:
        source = resolve_source(args.source)
        man, version = load_manifest(source)
        payload = build_payload(source, man, version)
        if payload["content_hash"] != lock.get("content_hash"):
            print(f"DESATUALIZADO: fonte esta em v{version} ({payload['content_hash'][:12]}); "
                  f"instalado v{lock.get('core_version')}. Rode install --upgrade.")
            return 1
        print(f"OK: em dia com a fonte (v{version})")
    return 0


def main():
    ap = argparse.ArgumentParser(prog="govcore", description="Distribuicao versionada do ASB Governance Core")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("pack", help="valida e resume o core (versao, commit, hash) sem alterar nada")
    p.add_argument("--source", help="caminho do core ou de um repo que o contenha")
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_pack)

    p = sub.add_parser("install", help="vendoriza o core no alvo e grava o lock")
    p.add_argument("--target", required=True, help="raiz do repo satelite")
    p.add_argument("--source", help="caminho do core ou de um repo que o contenha (offline)")
    p.add_argument("--upgrade", action="store_true", help="troca explicita de versao")
    p.add_argument("--dry-run", action="store_true", help="mostra o que faria, sem escrever")
    p.set_defaults(func=cmd_install)

    p = sub.add_parser("verify", help="verifica drift do vendorizado (read-only)")
    p.add_argument("--target", required=True, help="raiz do repo satelite")
    p.add_argument("--source", nargs="?", const="", default=None,
                   help="tambem compara com a fonte (detecta versao desatualizada)")
    p.set_defaults(func=cmd_verify)

    args = ap.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
