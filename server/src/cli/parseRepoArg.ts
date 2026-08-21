export function parseRepoFlag(argv: string[], usage: string): { owner: string; repo: string } {
  const repoIndex = argv.indexOf('--repo');
  const repoArg = repoIndex !== -1 ? argv[repoIndex + 1] : undefined;
  if (!repoArg) {
    throw new Error(usage);
  }

  const [owner, repo] = repoArg.split('/');
  if (!owner || !repo) {
    throw new Error(`--repo must be in the form owner/name, got "${repoArg}"`);
  }

  return { owner, repo };
}
