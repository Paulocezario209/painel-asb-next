#!/usr/bin/env python3
# asb_validate_state.py — valida .asb/project.json e .asb/workstreams/<id>.json contra .asb/schema/*.json
#
# NOTA DE ESCOPO: este validador implementa APENAS o subconjunto de JSON Schema usado pelos schemas ASB
# (type, required, enum, const, minLength, maxLength, minItems, maxItems, pattern, format:date-time,
#  properties, additionalProperties:false, items, allOf, if/then). NAO e um validador draft-07 completo.
#
# Stdlib-only (jsonschema/ajv AUSENTES no ambiente; NUNCA instala). Anti-segredo REUSA a regex do
# Guardiao 1 por extracao (fonte unica: .claude/hooks/preflight-gate.sh, linha SECRET_RE=...), com
# self-test de fixtures antes de aprovar. Se a regex Bash for incompativel com Python -> exit 4
# (fail-closed), sem traduzir silenciosamente.
#
# Exit: 0 ok | 1 schema/tamanho/duplicata/coerencia | 2 segredo | 3 uso/IO/caminho | 4 anti-segredo indisponivel
import sys, os, re, json, hashlib, subprocess

MAX_BYTES = 20000
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d+)?(Z|[+-]\d{2}:\d{2})$")


def die(code, msg):
    print(msg)
    sys.exit(code)


# ---------- (4) ROOT via git rev-parse --show-toplevel ----------
def git_root():
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=10)
        if out.returncode != 0:
            return None
        return out.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


# ---------- (5) anti-segredo: extrai + compila regex do Guardiao 1, com self-test ----------
class SecretGate:
    def __init__(self, root):
        self.g1 = None
        self.supp = None
        guard = os.path.join(root, ".claude", "hooks", "preflight-gate.sh")
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
            die(4, "ERRO: SECRET_RE do Guardiao 1 nao encontrado — fail-closed")
        try:
            self.g1 = re.compile(pat)               # NAO traduz: se sintaxe Bash != Python -> re.error
        except re.error as e:
            die(4, f"ERRO: regex do Guardiao 1 incompativel com Python ({e}) — fail-closed")
        # supplemento DECLARADO (nao vem do G1): nomes de campo proibidos com valor
        self.supp = re.compile(r'(?i)"(password|passwd|senha|secret|authorization|api[_-]?key|token)"\s*:\s*"[^"]{1,}"')
        # self-test: os fixtures sao MONTADOS por concatenacao (literal nao aparece na fonte)
        fx_jwt = "eyJ" + "A" * 22 + "." + "B" * 12
        fx_sk  = "sk" + "-" + "A" * 24
        fx_ghp = "ghp" + "_" + "A" * 36
        fx_pwd = '"' + "senha" + '": "' + "x" * 8 + '"'
        for name, fx, rx in (("JWT", fx_jwt, self.g1), ("sk-", fx_sk, self.g1),
                             ("ghp_", fx_ghp, self.g1), ("senha", fx_pwd, self.supp)):
            if not rx.search(fx):
                die(4, f"ERRO: self-test do anti-segredo falhou no fixture {name} — fail-closed")

    def scan(self, text):
        return bool(self.g1.search(text) or self.supp.search(text))


# ---------- validador de subconjunto de JSON Schema ----------
def is_type(v, t):
    if isinstance(t, list):
        return any(is_type(v, x) for x in t)
    if t == "integer":
        return isinstance(v, int) and not isinstance(v, bool)
    if t == "boolean":
        return isinstance(v, bool)
    if t == "null":
        return v is None
    return isinstance(v, {"object": dict, "array": list, "string": str}.get(t, object))


def validate(inst, sch, path, errs):
    if "type" in sch and not is_type(inst, sch["type"]):
        errs.append(f"{path}: type != {sch['type']}")
        return
    if "enum" in sch and inst not in sch["enum"]:
        errs.append(f"{path}: '{inst}' fora do enum")
    if "const" in sch and inst != sch["const"]:
        errs.append(f"{path}: != const {sch['const']!r}")
    if isinstance(inst, str):
        if "minLength" in sch and len(inst) < sch["minLength"]:
            errs.append(f"{path}: string curta (< {sch['minLength']})")
        if "maxLength" in sch and len(inst) > sch["maxLength"]:
            errs.append(f"{path}: string longa (> {sch['maxLength']})")
        if "pattern" in sch and not re.search(sch["pattern"], inst):
            errs.append(f"{path}: nao casa pattern {sch['pattern']}")
        if sch.get("format") == "date-time" and not ISO.match(inst):
            errs.append(f"{path}: date-time ISO8601 invalido")
    if isinstance(inst, list):
        if "minItems" in sch and len(inst) < sch["minItems"]:
            errs.append(f"{path}: poucos itens (< {sch['minItems']})")
        if "maxItems" in sch and len(inst) > sch["maxItems"]:
            errs.append(f"{path}: itens demais (> {sch['maxItems']})")
        if "items" in sch:
            for i, el in enumerate(inst):
                validate(el, sch["items"], f"{path}[{i}]", errs)
    if isinstance(inst, dict):
        props = sch.get("properties", {})
        for r in sch.get("required", []):
            if r not in inst:
                errs.append(f"{path}: falta obrigatorio '{r}'")
        if sch.get("additionalProperties", True) is False:
            for k in inst:
                if k not in props:
                    errs.append(f"{path}: chave desconhecida '{k}'")
        for k, v in inst.items():
            if k in props:
                validate(v, props[k], f"{path}.{k}", errs)
    for sub in sch.get("allOf", []):
        if "if" in sub:
            pre = []
            validate(inst, sub["if"], path, pre)
            if not pre and "then" in sub:
                validate(inst, sub["then"], path, errs)
        else:
            validate(inst, sub, path, errs)


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def first_dups(items, keyfn):
    seen, dups = set(), []
    for x in items:
        k = keyfn(x)
        if k in seen:
            dups.append(k)
        seen.add(k)
    return dups


class DupKey(Exception):
    pass


def no_dup_keys(pairs):
    seen = set()
    d = {}
    for k, v in pairs:
        if k in seen:
            raise DupKey(k)
        seen.add(k)
        d[k] = v
    return d


def main():
    if len(sys.argv) != 2:
        die(3, "uso: asb_validate_state.py <arquivo.json>")
    root = git_root()
    if not root:
        die(3, "ERRO: nao estou num working tree git (git rev-parse --show-toplevel falhou)")
    target = sys.argv[1]
    tgt_abs = os.path.realpath(target)
    asb_abs = os.path.realpath(os.path.join(root, ".asb"))
    # (4) so valida dentro de .asb do repo canonico
    if not (tgt_abs == asb_abs or tgt_abs.startswith(asb_abs + os.sep)):
        die(3, f"ERRO: caminho fora de {asb_abs} — recusado")
    proj_abs = os.path.realpath(os.path.join(root, ".asb", "project.json"))
    ws_dir = os.path.realpath(os.path.join(root, ".asb", "workstreams"))
    if tgt_abs == proj_abs:
        kind = "project"
    elif tgt_abs.startswith(ws_dir + os.sep):
        kind = "workstream"
    else:
        die(3, "ERRO: alvo nao e .asb/project.json nem .asb/workstreams/<id>.json")
    schema_path = os.path.join(root, ".asb", "schema", kind + ".schema.json")

    try:
        if os.path.getsize(tgt_abs) > MAX_BYTES:
            die(1, f"INVALIDO: {target} > {MAX_BYTES} bytes")
        raw = open(tgt_abs, encoding="utf-8").read()
        sch = json.load(open(schema_path, encoding="utf-8"))
    except OSError as e:
        die(3, f"ERRO IO: {e}")
    try:
        inst = json.loads(raw, object_pairs_hook=no_dup_keys)
    except DupKey as e:
        die(1, f"INVALIDO: chave JSON duplicada: '{e}'")
    except ValueError as e:
        die(3, f"ERRO JSON malformado: {e}")

    # (5) anti-segredo com self-test; depois scan
    gate = SecretGate(root)
    if gate.scan(raw):
        die(2, "SEGREDO detectado no estado — recusado")

    errs = []
    validate(inst, sch, kind, errs)

    # (2) coerencia id/hash/filename para workstream — OBRIGATORIA (nunca pula em silencio)
    if kind == "workstream":
        wid = inst.get("id") if isinstance(inst, dict) else None
        branch = inst.get("branch") if isinstance(inst, dict) else None
        task_id = inst.get("task_id") if isinstance(inst, dict) else None
        fname = os.path.basename(tgt_abs)
        ok = True
        if not (isinstance(branch, str) and branch):
            errs.append("coerencia: 'branch' ausente/invalido"); ok = False
        if not (isinstance(task_id, str) and task_id):
            errs.append("coerencia: 'task_id' ausente/invalido"); ok = False
        if not (isinstance(wid, str) and wid):
            errs.append("coerencia: 'id' ausente/invalido"); ok = False
        if ok:
            exp_hash = hashlib.sha1(f"{branch}|{task_id}".encode("utf-8")).hexdigest()[:8]
            exp_id = f"{slugify(task_id)}-{exp_hash}"
            if wid != exp_id:
                errs.append(f"id incoerente: '{wid}' != esperado '{exp_id}' (hash de branch|task_id)")
            if fname != wid + ".json":
                errs.append(f"filename '{fname}' != '{wid}.json'")
        # (3) duplicatas em colecoes (so se for objeto)
        if isinstance(inst, dict):
            for d in first_dups(inst.get("decisions", []), lambda x: x.get("id")):
                errs.append(f"decision.id duplicado: {d}")
            for d in first_dups(inst.get("blockers", []), lambda x: x.get("id")):
                errs.append(f"blocker.id duplicado: {d}")
            for d in first_dups(inst.get("debts", []), lambda x: x):
                errs.append(f"DEBT duplicado: {d}")
            for d in first_dups(inst.get("evidence", []), lambda x: (x.get("type"), x.get("ref"))):
                errs.append(f"evidence type+ref duplicado: {d}")

    if errs:
        print("INVALIDO:")
        for e in errs:
            print("  -", e)
        sys.exit(1)
    print(f"OK: {target} valido contra {kind}.schema.json")
    sys.exit(0)


if __name__ == "__main__":
    main()
