import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const CSS_UNSAFE = /["';{}\\<>]/g;

export function label(text, style, align = Clutter.ActorAlign.CENTER) {
  return new St.Label({text, style, x_align: align, y_align: Clutter.ActorAlign.CENTER});
}

// Text for a user-written format; null when the format is empty, the format
// text itself when GLib rejects it.
export function formatted(now, format) {
  if (!format) return null;
  return now.format(format) ?? format;
}

// A card on the desktop with its own settings (keys start with `prefix`),
// placed by fractions of the primary monitor and draggable in edit mode.
// Subclasses fill the card in build().
export const DesktopWidget = GObject.registerClass(
class DesktopWidget extends St.BoxLayout {
  _init(settings, prefix) {
    super._init({style_class: `triland-${prefix}`, vertical: true, reactive: false});
    this._settings = settings;
    this._prefix = prefix;
    this._mode = null;
    this._grab = null;
    this._raising = false;

    this.connect('button-press-event', (_a, ev) => this._onPress(ev));
    this.connect('motion-event', (_a, ev) => this._onMotion(ev));
    this.connect('button-release-event', () => this._onRelease());
    this.connect('destroy', () => this._detach());
  }

  // Setting names: everything is `<prefix>-<name>`; edit-mode is shared.
  ownsKey(name) {
    return name.startsWith(`${this._prefix}-`);
  }

  _k(name) {
    return `${this._prefix}-${name}`;
  }

  _str(name) { return this._settings.get_string(this._k(name)); }
  _int(name) { return this._settings.get_int(this._k(name)); }

  // ----- layout and look -----

  rebuild() {
    this.destroy_all_children();
    this._applyCardStyle();
    this.visible = this._settings.get_boolean(this._k('enabled'));
    this.build();
    this.place();
  }

  build() {}

  _text(scale = 1, extra = '') {
    const family = this._str('font-family').replace(CSS_UNSAFE, '');
    const size = Math.round(this._int('font-size') * scale);
    return `font-size: ${size}px; color: ${this._str('text-color').replace(CSS_UNSAFE, '')};` +
      (family ? ` font-family: "${family}";` : '') + extra;
  }

  _applyCardStyle() {
    const alpha = this._int('bg-opacity') / 100;
    this.style = `background-color: rgba(0, 0, 0, ${alpha}); ` +
      `border-radius: ${this._int('radius')}px; padding: ${this._int('padding')}px;`;
    if (this._settings.get_boolean('edit-mode')) this.add_style_class_name('triland-edit');
    else this.remove_style_class_name('triland-edit');
  }

  // ----- placement -----

  place() {
    const m = Main.layoutManager.primaryMonitor;
    if (!m) return;
    const w = this.get_preferred_width(-1)[1];
    const h = this.get_preferred_height(w)[1];
    const s = this._settings;
    this.set_position(
      Math.round(m.x + s.get_double(this._k('pos-x')) * Math.max(0, m.width - w)),
      Math.round(m.y + s.get_double(this._k('pos-y')) * Math.max(0, m.height - h)));
  }

  // Normal mode: sit in the desktop background layer, above the wallpaper
  // and below every window. Edit mode: float above everything so the pointer
  // reaches the widget and it can be dragged.
  attach() {
    this._detach();
    const editing = this._settings.get_boolean('edit-mode');
    this.reactive = editing;
    if (editing) {
      Main.layoutManager.addTopChrome(this);
      this._mode = 'chrome';
    } else {
      const bg = Main.layoutManager._backgroundGroup;
      bg.add_child(this);
      this._mode = 'bg';
      this._bgAddedId = bg.connect('child-added', (_g, child) => {
        if (child === this || this._raising) return;
        this._raising = true;
        bg.set_child_above_sibling(this, null);
        this._raising = false;
      });
    }
    this.rebuild();
  }

  _detach() {
    if (this._bgAddedId) {
      Main.layoutManager._backgroundGroup.disconnect(this._bgAddedId);
      this._bgAddedId = null;
    }
    this._onRelease();
    if (this._mode === 'chrome') Main.layoutManager.removeChrome(this);
    else if (this._mode === 'bg') this.get_parent()?.remove_child(this);
    this._mode = null;
  }

  // ----- dragging (edit mode only) -----

  _onPress(ev) {
    if (this._mode !== 'chrome') return Clutter.EVENT_PROPAGATE;
    const [px, py] = ev.get_coords();
    this._dragOffset = [px - this.x, py - this.y];
    this._grab = global.stage.grab(this);
    return Clutter.EVENT_STOP;
  }

  _onMotion(ev) {
    if (!this._grab) return Clutter.EVENT_PROPAGATE;
    const m = Main.layoutManager.primaryMonitor;
    const [px, py] = ev.get_coords();
    const x = Math.min(Math.max(px - this._dragOffset[0], m.x), m.x + m.width - this.width);
    const y = Math.min(Math.max(py - this._dragOffset[1], m.y), m.y + m.height - this.height);
    this.set_position(Math.round(x), Math.round(y));
    return Clutter.EVENT_STOP;
  }

  _onRelease() {
    if (!this._grab) return Clutter.EVENT_PROPAGATE;
    this._grab.dismiss();
    this._grab = null;
    const m = Main.layoutManager.primaryMonitor;
    const spanX = m.width - this.width;
    const spanY = m.height - this.height;
    const s = this._settings;
    // Work out both fractions before saving: each save re-places the widget
    // from the stored values, which would undo the other axis.
    const fx = spanX > 0 ? Math.min(1, Math.max(0, (this.x - m.x) / spanX)) : s.get_double(this._k('pos-x'));
    const fy = spanY > 0 ? Math.min(1, Math.max(0, (this.y - m.y) / spanY)) : s.get_double(this._k('pos-y'));
    s.set_double(this._k('pos-x'), fx);
    s.set_double(this._k('pos-y'), fy);
    return Clutter.EVENT_STOP;
  }
});
