import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');
Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');
Gio._promisify(Gio.Subprocess.prototype, 'wait_check_async', 'wait_check_finish');

// Browse list: Fontsource metadata. Files: the google/fonts repository, which
// holds the complete TTFs (Fontsource only ships per-script subsets). The
// files come from raw.githubusercontent.com: jsDelivr refuses some of them.
const LIST_URL = 'https://api.fontsource.org/v1/fonts';
const REPO_API = 'https://api.github.com/repos/google/fonts/contents';
const RAW_PREFIX = 'https://raw.githubusercontent.com/google/fonts/';
const LICENSE_DIR = {'OFL-1.1': 'ofl', 'Apache-2.0': 'apache', 'UFL-1.0': 'ufl'};
const CACHE_MAX_AGE_S = 24 * 3600;
const FILE_NAME = /^[A-Za-z0-9\-_[\],]+\.(ttf|otf)$/;
const FONT_ID = /^[a-z0-9-]+$/;
const FONT_MAGIC = ['\x00\x01\x00\x00', 'true', 'OTTO'];

const session = new Soup.Session({timeout: 30, user_agent: 'triland-clock'});
const decoder = new TextDecoder();

// The folder keeps the name of the earlier Triland Calendar extension so fonts
// installed back then still show up as installed.
export const installRoot = () =>
  GLib.build_filenamev([GLib.get_user_data_dir(), 'fonts', 'triland-calendar']);
const cachePath = () =>
  GLib.build_filenamev([GLib.get_user_cache_dir(), 'triland-calendar', 'fonts.json']);

async function get(url) {
  const msg = Soup.Message.new('GET', url);
  const bytes = await session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null);
  if (msg.status_code !== 200) throw new Error(`HTTP ${msg.status_code} from ${msg.get_uri().get_host()}`);
  return bytes;
}

function dirOf(font) {
  return GLib.build_filenamev([installRoot(), font.id]);
}

function listFiles(dir) {
  try {
    const en = Gio.File.new_for_path(dir).enumerate_children('standard::name', 0, null);
    const names = [];
    for (let i = en.next_file(null); i; i = en.next_file(null)) names.push(i.get_name());
    return names;
  } catch (_e) {
    return [];
  }
}

export const isInstalled = (font) => listFiles(dirOf(font)).length > 0;

// Installable fonts only: Google-hosted families under an open license.
export async function loadFontList() {
  const cache = Gio.File.new_for_path(cachePath());
  let text = null;
  try {
    const age = GLib.get_real_time() / 1e6 -
      cache.query_info('time::modified', 0, null).get_modification_date_time().to_unix();
    if (age < CACHE_MAX_AGE_S) text = decoder.decode(cache.load_contents(null)[1]);
  } catch (_e) { /* no cache yet */ }

  if (text === null) {
    text = decoder.decode((await get(LIST_URL)).toArray());
    GLib.mkdir_with_parents(GLib.path_get_dirname(cachePath()), 0o755);
    cache.replace_contents(text, null, false, Gio.FileCreateFlags.NONE, null);
  }

  return JSON.parse(text)
    .filter((f) => f.type === 'google' && LICENSE_DIR[f.license] && FONT_ID.test(f.id))
    .map((f) => ({
      id: f.id,
      family: f.family,
      category: f.category,
      license: f.license,
      thai: f.subsets.includes('thai'),
    }));
}

export async function installFont(font) {
  const repoDir = `${LICENSE_DIR[font.license]}/${font.family.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const listing = JSON.parse(decoder.decode((await get(`${REPO_API}/${repoDir}`)).toArray()));
  const files = listing.filter((e) => e.type === 'file' && FILE_NAME.test(e.name) &&
    typeof e.download_url === 'string' && e.download_url.startsWith(RAW_PREFIX));
  if (files.length === 0) throw new Error(`No font files found for ${font.family}`);

  const target = dirOf(font);
  GLib.mkdir_with_parents(target, 0o755);
  for (const {name, download_url: url} of files) {
    const bytes = await get(url);
    const head = decoder.decode(bytes.toArray().slice(0, 4));
    if (!FONT_MAGIC.includes(head)) throw new Error(`${name} is not a font file`);
    await Gio.File.new_for_path(GLib.build_filenamev([target, name]))
      .replace_contents_bytes_async(bytes, null, false, Gio.FileCreateFlags.NONE, null);
  }
  await refreshCache(target);
}

export async function removeFont(font) {
  const target = dirOf(font);
  for (const name of listFiles(target)) Gio.File.new_for_path(GLib.build_filenamev([target, name])).delete(null);
  Gio.File.new_for_path(target).delete(null);
  await refreshCache(installRoot());
}

async function refreshCache(dir) {
  await Gio.Subprocess.new(['fc-cache', '-f', dir], Gio.SubprocessFlags.NONE).wait_check_async(null);
}

// Picture of `text` in `family`, drawn by a separate process because this one
// does not see fonts installed after it started. `rgb` is 0..1 per channel.
export async function renderPreview(extensionPath, family, size, rgb, text) {
  const dir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'triland-calendar']);
  GLib.mkdir_with_parents(dir, 0o755);
  const out = GLib.build_filenamev([dir, `preview-${GLib.uuid_string_random()}.png`]);
  const proc = Gio.Subprocess.new(
    ['gjs', '-m', GLib.build_filenamev([extensionPath, 'renderPreview.js']), out, family, `${size}`,
      ...rgb.map(String), text],
    Gio.SubprocessFlags.STDERR_SILENCE);
  try {
    await proc.wait_check_async(null);
    return Gdk.Texture.new_from_filename(out);
  } finally {
    GLib.unlink(out);
  }
}
