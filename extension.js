import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {CalendarWidget} from './calendarWidget.js';
import {ClockWidget} from './clockWidget.js';

export default class ClockCalendarDesktop extends Extension {
  enable() {
    this._settings = this.getSettings();
    // Edit mode is a temporary state: never start a session in it.
    this._settings.set_boolean('edit-mode', false);

    this._widgets = [new ClockWidget(this._settings), new CalendarWidget(this._settings)];
    this._settingsId = this._settings.connect('changed', (_s, key) => this._onChanged(key));
    this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this._widgets.forEach((w) => w.place()));

    // The background group does not exist in its final state while the shell starts.
    if (Main.layoutManager._startingUp) {
      this._startupId = Main.layoutManager.connect('startup-complete', () => {
        Main.layoutManager.disconnect(this._startupId);
        this._startupId = null;
        this._widgets.forEach((w) => w.attach());
      });
    } else {
      this._widgets.forEach((w) => w.attach());
    }

    this._tick = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
      const [clock, calendar] = this._widgets;
      if (clock.visible) clock.tick();
      if (calendar.visible) calendar.refreshIfNewDay();
      return GLib.SOURCE_CONTINUE;
    });
  }

  disable() {
    if (this._tick) GLib.source_remove(this._tick);
    this._tick = null;
    if (this._startupId) Main.layoutManager.disconnect(this._startupId);
    this._startupId = null;
    Main.layoutManager.disconnect(this._monitorsId);
    this._settings.disconnect(this._settingsId);
    this._widgets.forEach((w) => w.destroy());
    this._widgets = null;
    this._settings = null;
  }

  _onChanged(key) {
    if (key === 'edit-mode') {
      this._widgets.forEach((w) => w.attach());
      return;
    }
    for (const w of this._widgets) {
      if (!w.ownsKey(key)) continue;
      if (key.endsWith('-pos-x') || key.endsWith('-pos-y')) w.place();
      else w.rebuild();
    }
  }
}
