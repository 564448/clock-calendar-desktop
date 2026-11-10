import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Pango from 'gi://Pango';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {installFont, isInstalled, loadFontList, removeFont, renderPreview} from './fonts.js';

const MAX_ROWS = 60;

function bindSpin(group, settings, key, title, step = 1) {
  const range = settings.settings_schema.get_key(key).get_range().deepUnpack()[1].deepUnpack();
  const row = new Adw.SpinRow({
    title,
    adjustment: new Gtk.Adjustment({lower: range[0], upper: range[1], step_increment: step, value: settings.get_int(key)}),
  });
  settings.bind(key, row, 'value', 0);
  group.add(row);
}

function colorButton(settings, key) {
  const button = new Gtk.ColorDialogButton({valign: Gtk.Align.CENTER, dialog: new Gtk.ColorDialog()});
  const rgba = new Gdk.RGBA();
  if (rgba.parse(settings.get_string(key))) button.rgba = rgba;
  button.connect('notify::rgba', () => settings.set_string(key, button.rgba.to_string()));
  return button;
}

function formatRow(settings, key, title) {
  const row = new Adw.EntryRow({title, text: settings.get_string(key), show_apply_button: true});
  const example = new Gtk.Label({css_classes: ['dim-label'], valign: Gtk.Align.CENTER});
  const showExample = () => {
    const now = GLib.DateTime.new_now_local();
    example.label = row.text ? (now.format(row.text) ?? '(invalid)') : '(hidden)';
  };
  row.add_suffix(example);
  showExample();
  row.connect('changed', showExample);
  row.connect('apply', () => settings.set_string(key, row.text));
  return row;
}

function fontRow(group, settings, key) {
  const fontButton = new Gtk.FontDialogButton({
    valign: Gtk.Align.CENTER,
    use_font: true,
    level: Gtk.FontLevel.FAMILY,
    dialog: new Gtk.FontDialog(),
  });
  const showFont = () => {
    fontButton.font_desc = Pango.font_description_from_string(settings.get_string(key) || 'Sans');
  };
  showFont();
  fontButton.connect('notify::font-desc', () => {
    const family = fontButton.font_desc?.get_family() ?? '';
    if (family !== settings.get_string(key)) settings.set_string(key, family);
  });
  settings.connect(`changed::${key}`, showFont);
  const row = new Adw.ActionRow({title: 'Font', subtitle: 'Any installed font; use the Fonts page to get more'});
  row.add_suffix(fontButton);
  group.add(row);
}

function colorRow(group, settings, key, title) {
  const row = new Adw.ActionRow({title});
  row.add_suffix(colorButton(settings, key));
  group.add(row);
}

function formatGroup(settings, rows) {
  const group = new Adw.PreferencesGroup({
    title: 'Text format',
    description: 'Write each line yourself with date and time codes, e.g. %H:%M gives "14:05". ' +
      'Common codes: %H hour 00-23, %I hour 01-12, %M minute, %S second, %p AM/PM, %A weekday, %a short weekday, ' +
      '%B month, %b short month, %-d day, %Y year. Leave a field empty to hide that line. ' +
      'All codes: docs.gtk.org/glib/method.DateTime.format.html',
  });
  for (const [key, title] of rows) group.add(formatRow(settings, key, title));
  return group;
}

function cardGroup(settings, p) {
  const card = new Adw.PreferencesGroup({title: 'Card'});
  bindSpin(card, settings, `${p}-bg-opacity`, 'Background opacity (%)');
  bindSpin(card, settings, `${p}-radius`, 'Corner radius (px)');
  bindSpin(card, settings, `${p}-padding`, 'Padding (px)');
  return card;
}

function showSwitch(settings, p, title) {
  const group = new Adw.PreferencesGroup();
  const row = new Adw.SwitchRow({title});
  settings.bind(`${p}-enabled`, row, 'active', 0);
  group.add(row);
  return group;
}

function buildClock(settings) {
  const page = new Adw.PreferencesPage({title: 'Clock', icon_name: 'preferences-system-time-symbolic'});
  page.add(showSwitch(settings, 'clock', 'Show the clock on the desktop'));
  page.add(formatGroup(settings, [['clock-time-format', 'Time line'], ['clock-date-format', 'Date line']]));
  const text = new Adw.PreferencesGroup({title: 'Text'});
  fontRow(text, settings, 'clock-font-family');
  bindSpin(text, settings, 'clock-time-size', 'Time size (px)');
  bindSpin(text, settings, 'clock-font-size', 'Date size (px)');
  colorRow(text, settings, 'clock-text-color', 'Text color');
  page.add(text);
  page.add(cardGroup(settings, 'clock'));
  return page;
}

function buildCalendar(settings) {
  const page = new Adw.PreferencesPage({title: 'Calendar', icon_name: 'x-office-calendar-symbolic'});
  page.add(showSwitch(settings, 'cal', 'Show the calendar on the desktop'));

  const layout = new Adw.PreferencesGroup({title: 'Layout'});
  const styles = ['grid', 'week', 'minimal'];
  const styleRow = new Adw.ComboRow({
    title: 'Style',
    subtitle: 'Month grid, current week strip, or a big day number',
    model: Gtk.StringList.new(['Month grid', 'Week strip', 'Minimal']),
    selected: Math.max(0, styles.indexOf(settings.get_string('cal-style'))),
  });
  styleRow.connect('notify::selected', () => settings.set_string('cal-style', styles[styleRow.selected]));
  layout.add(styleRow);
  const weekRow = new Adw.ComboRow({
    title: 'Week starts on',
    model: Gtk.StringList.new(['Sunday', 'Monday']),
    selected: settings.get_int('cal-week-start'),
  });
  weekRow.connect('notify::selected', () => settings.set_int('cal-week-start', weekRow.selected));
  layout.add(weekRow);
  page.add(layout);

  page.add(formatGroup(settings, [
    ['cal-grid-title-format', 'Month grid heading'],
    ['cal-weekday-format', 'Weekday names'],
    ['cal-week-title-format', 'Week strip heading'],
    ['cal-minimal-day-format', 'Minimal: top line'],
    ['cal-minimal-weekday-format', 'Minimal: middle line'],
    ['cal-minimal-month-format', 'Minimal: bottom line'],
  ]));

  const text = new Adw.PreferencesGroup({title: 'Text'});
  fontRow(text, settings, 'cal-font-family');
  bindSpin(text, settings, 'cal-font-size', 'Font size (px)');
  colorRow(text, settings, 'cal-text-color', 'Text color');
  colorRow(text, settings, 'cal-accent-color', 'Today highlight color');
  page.add(text);
  page.add(cardGroup(settings, 'cal'));
  return page;
}

function buildPosition(settings) {
  const page = new Adw.PreferencesPage({title: 'Position', icon_name: 'view-fullscreen-symbolic'});
  const group = new Adw.PreferencesGroup({
    title: 'Move mode',
    description: 'Turn on Move mode, then drag the clock and the calendar on the desktop. ' +
      'They float above windows and desktop icons while moving, and go back to the desktop when you turn it off.',
  });
  page.add(group);
  const edit = new Adw.SwitchRow({title: 'Move mode'});
  settings.bind('edit-mode', edit, 'active', 0);
  group.add(edit);
  for (const [p, name] of [['clock', 'Clock'], ['cal', 'Calendar']]) {
    const g = new Adw.PreferencesGroup({title: name});
    page.add(g);
    for (const [suffix, title] of [['pos-x', 'Horizontal (%)'], ['pos-y', 'Vertical (%)']]) {
      const key = `${p}-${suffix}`;
      const row = new Adw.SpinRow({
        title,
        adjustment: new Gtk.Adjustment({lower: 0, upper: 100, step_increment: 1, value: Math.round(settings.get_double(key) * 100)}),
      });
      row.connect('notify::value', () => {
        if (Math.abs(settings.get_double(key) * 100 - row.value) > 0.5) settings.set_double(key, row.value / 100);
      });
      settings.connect(`changed::${key}`, () => {
        const v = Math.round(settings.get_double(key) * 100);
        if (v !== row.value) row.value = v;
      });
      g.add(row);
    }
  }
  return page;
}

function buildFonts(settings, extensionPath) {
  const targets = [['clock-font-family'], ['cal-font-family'], ['clock-font-family', 'cal-font-family']];
  const target = new Adw.ComboRow({
    title: 'Use fonts for',
    model: Gtk.StringList.new(['Clock', 'Calendar', 'Clock and calendar']),
  });
  const page = new Adw.PreferencesPage({title: 'Fonts', icon_name: 'font-x-generic-symbolic'});
  const controls = new Adw.PreferencesGroup({
    title: 'Browse fonts',
    description: 'Free fonts from Google Fonts (OFL, Apache and Ubuntu licenses). ' +
      'Install puts them in ~/.local/share/fonts/triland-calendar so every app can use them.',
  });
  page.add(controls);

  // Live preview: the chosen font, drawn with the text typed here.
  const sample = 'สวัสดี Hello 0123456789';
  const previewText = new Adw.EntryRow({title: 'Preview text', text: sample});
  const previewPicture = new Gtk.Picture({can_shrink: false, halign: Gtk.Align.START, margin_top: 8, margin_bottom: 8});
  const previewGroup = new Adw.PreferencesGroup({title: 'Preview'});
  previewGroup.add(previewText);
  previewGroup.add(previewPicture);
  page.add(previewGroup);

  const show = async (picture, family, size, text) => {
    try {
      const color = picture.get_color();
      picture.set_paintable(await renderPreview(extensionPath, family, size, [color.red, color.green, color.blue], text));
    } catch (e) {
      picture.set_paintable(null);
      log(`triland-clock preview: ${e.message}`);
    }
  };
  let previewTimer = 0;
  const refreshPreview = () => {
    const family = settings.get_string(targets[target.selected][0]);
    previewGroup.description = family ? `Font in use: ${family}` : 'Font in use: system font';
    show(previewPicture, family || 'Sans', 28, previewText.text || sample);
  };
  previewText.connect('changed', () => {
    if (previewTimer) GLib.source_remove(previewTimer);
    previewTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
      previewTimer = 0;
      refreshPreview();
      for (const r of rows) r.refreshSample();
      return GLib.SOURCE_REMOVE;
    });
  });
  for (const key of ['clock-font-family', 'cal-font-family']) settings.connect(`changed::${key}`, refreshPreview);
  target.connect('notify::selected', refreshPreview);
  refreshPreview();

  controls.add(target);
  const search = new Adw.EntryRow({title: 'Search by name'});
  const thai = new Adw.SwitchRow({title: 'Thai support only'});
  const status = new Adw.ActionRow({title: 'Loading font list…'});
  controls.add(search);
  controls.add(thai);
  controls.add(status);

  const results = new Adw.PreferencesGroup();
  page.add(results);

  let fonts = [];
  let rows = [];

  const setStatus = (text) => { status.title = text; };

  const makeRow = (font) => {
    const row = new Adw.ActionRow({
      title: GLib.markup_escape_text(font.family, -1),
      subtitle: `${font.category} · ${font.license}${font.thai ? ' · Thai' : ''}`,
    });
    const action = new Gtk.Button({valign: Gtk.Align.CENTER});
    const use = new Gtk.Button({label: 'Use', valign: Gtk.Align.CENTER, css_classes: ['suggested-action']});
    const spinner = new Gtk.Spinner({valign: Gtk.Align.CENTER});
    const sampleImage = new Gtk.Picture({can_shrink: false, valign: Gtk.Align.CENTER, margin_end: 12});
    use.connect('clicked', () => targets[target.selected].forEach((key) => settings.set_string(key, font.family)));

    const sync = () => {
      const installed = isInstalled(font);
      action.label = installed ? 'Remove' : 'Install';
      use.visible = installed;
      // An installed font shows a sample of itself; the others need Install first.
      sampleImage.visible = installed;
      if (installed) show(sampleImage, font.family, 18, previewText.text || sample);
    };
    action.connect('clicked', async () => {
      action.sensitive = false;
      spinner.start();
      try {
        if (isInstalled(font)) await removeFont(font);
        else await installFont(font);
        setStatus(isInstalled(font) ? `Installed ${font.family}` : `Removed ${font.family}`);
      } catch (e) {
        setStatus(`${font.family}: ${e.message}`);
      } finally {
        spinner.stop();
        action.sensitive = true;
        sync();
      }
    });
    row.add_suffix(sampleImage);
    row.add_suffix(spinner);
    row.add_suffix(use);
    row.add_suffix(action);
    sync();
    row.refreshSample = () => { if (isInstalled(font)) show(sampleImage, font.family, 18, previewText.text || sample); };
    return row;
  };

  const refill = () => {
    for (const r of rows) results.remove(r);
    rows = [];
    const q = search.text.trim().toLowerCase();
    const hits = fonts.filter((f) => (!thai.active || f.thai) && f.family.toLowerCase().includes(q));
    for (const f of hits.slice(0, MAX_ROWS)) {
      const row = makeRow(f);
      results.add(row);
      rows.push(row);
    }
    setStatus(hits.length > MAX_ROWS
      ? `${hits.length} fonts match; showing the first ${MAX_ROWS}. Type to narrow down.`
      : `${hits.length} fonts match`);
  };

  search.connect('changed', refill);
  thai.connect('notify::active', refill);

  loadFontList().then((list) => {
    fonts = list;
    refill();
  }).catch((e) => setStatus(`Could not load the font list: ${e.message}`));

  return page;
}

export default class ClockCalendarDesktopPrefs extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    window.add(buildClock(settings));
    window.add(buildCalendar(settings));
    window.add(buildPosition(settings));
    window.add(buildFonts(settings, this.path));
    window.set_default_size(640, 760);
  }
}
