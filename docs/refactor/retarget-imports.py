import os, re, sys, subprocess
REPO = '/home/birb/dev/plazma-burst-2-desktop'
ROOTS = ['desktop', 'src', 'test', 'tools', 'server']
EXTS = ('.js', '.mjs', '.cjs', '.ts')

def files():
    for root in ROOTS:
        for dirpath, dirnames, filenames in os.walk(os.path.join(REPO, root)):
            dirnames[:] = [d for d in dirnames if d not in ('node_modules',)]
            for name in filenames:
                if name.endswith(EXTS):
                    yield os.path.join(dirpath, name)

ALIASES = [('src/console/', '#console/'), ('src/kernel/', '#kernel/'), ('src/shared/', '#shared/'), ('src/features/', '#features/')]

def rel(from_file, target):
    if from_file.startswith(os.path.join(REPO, 'src') + os.sep) and from_file.endswith('.ts'):
        target_rel = os.path.relpath(target, REPO)
        for folder, alias in ALIASES:
            if target_rel.startswith(folder) and not os.path.relpath(from_file, REPO).startswith(folder):
                return alias + target_rel[len(folder):]
    r = os.path.relpath(target, os.path.dirname(from_file))
    return r if r.startswith('.') else './' + r

def main():
    pairs = []
    renames = {}
    args = sys.argv[1:]
    while args:
        if args[0] == '--rename':
            old, new = args[1].split('=')
            renames[old] = new
            args = args[2:]
        else:
            pairs.append((os.path.join(REPO, args[0]), os.path.join(REPO, args[1])))
            args = args[2:]
    spec = re.compile(r"""(from\s+|import\s*\(\s*|require\(\s*)(['"])([^'"]+)\2""")
    changed = []
    leftovers = []
    for path in files():
        if any(path == old for old, _ in pairs):
            continue
        text = open(path, encoding='utf-8').read()
        touched_targets = set()
        def repl(match):
            prefix, quote, specifier = match.groups()
            if not specifier.startswith('.'):
                return match.group(0)
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), specifier))
            for old, new in pairs:
                if resolved == old:
                    touched_targets.add(new)
                    return f"{prefix}{quote}{rel(path, new)}{quote}"
            return match.group(0)
        new_text = spec.sub(repl, text)
        if new_text != text and renames:
            for old_name, new_name in renames.items():
                new_text = re.sub(r'(?<![\w$.])' + re.escape(old_name) + r'(?![\w$])', new_name, new_text)
        if new_text != text:
            open(path, 'w', encoding='utf-8').write(new_text)
            changed.append(os.path.relpath(path, REPO))
        for old, _ in pairs:
            base = os.path.relpath(old, os.path.join(REPO, 'desktop/dev/console'))
            if base in text and path.endswith(('.mjs',)) and new_text == text:
                leftovers.append(os.path.relpath(path, REPO))
    for old, _ in pairs:
        if os.path.exists(old):
            subprocess.run(['git', 'rm', '-q', '-f', old], cwd=REPO, check=True)
    print('changed:', ' '.join(changed))
    if leftovers:
        print('check string references in:', ' '.join(sorted(set(leftovers))))

main()
