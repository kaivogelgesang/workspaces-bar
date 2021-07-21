/* 
    Workspaces Bar
    Copyright Francois Thirioux 2021
    GitHub contributors: @fthx
    License GPL v3
*/


const { Clutter, Gio, GObject, Shell, St } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const WORKSPACES_SCHEMA = "org.gnome.desktop.wm.preferences";
const WORKSPACES_KEY = "workspace-names";


const WorkspacesBar = GObject.registerClass(
    class WorkspacesBar extends PanelMenu.Button {
        _init() {
            super._init(0.0, 'Workspaces bar');

            // define gsettings schema for workspaces names, get workspaces names, signal for settings key changed
            this.workspaces_settings = new Gio.Settings({ schema: WORKSPACES_SCHEMA });
            this.workspaces_names_changed = this.workspaces_settings.connect(`changed::${WORKSPACES_KEY}`, this._update_workspaces_names.bind(this));

            // bar creation
            this.ws_bar = new St.BoxLayout({});
            this._update_workspaces_names();
            this.add_child(this.ws_bar);

            // signals for workspaces state: active workspace, number of workspaces
            this._ws_active_changed = global.workspace_manager.connect('active-workspace-changed', this._update_ws.bind(this));
            this._ws_number_changed = global.workspace_manager.connect('notify::n-workspaces', this._update_ws.bind(this));
            this._restacked = global.display.connect('restacked', this._update_ws.bind(this));
            this._windows_changed = Shell.WindowTracker.get_default().connect('tracked-windows-changed', this._update_ws.bind(this));
        }

        // remove signals, restore Activities button, destroy workspaces bar
        _destroy() {
            if (this._ws_active_changed) {
                global.workspace_manager.disconnect(this._ws_active_changed);
            }
            if (this._ws_number_changed) {
                global.workspace_manager.disconnect(this._ws_number_changed);
            }
            if (this._restacked) {
                global.display.disconnect(this._restacked);
            }
            if (this._windows_changed) {
                Shell.WindowTracker.get_default().disconnect(this._windows_changed);
            }
            if (this.workspaces_names_changed) {
                this.workspaces_settings.disconnect(this.workspaces_names_changed);
            }
            this.ws_bar.destroy();
            super.destroy();
        }

        // update workspaces names
        _update_workspaces_names() {
            this.workspaces_names = this.workspaces_settings.get_strv(WORKSPACES_KEY);
            this._update_ws();
        }

        // update the workspaces bar
        _update_ws() {
            // destroy old workspaces bar buttons
            this.ws_bar.destroy_all_children();

            // get number of workspaces
            this.ws_count = global.workspace_manager.get_n_workspaces();
            this.active_ws_index = global.workspace_manager.get_active_workspace_index();

            // display all current workspaces buttons
            for (let ws_index = 0; ws_index < this.ws_count; ++ws_index) {

                let ws = global.workspace_manager.get_workspace_by_index(ws_index);

                // only show non-empty workspaces
                // or the currently active one
                if (!(ws_index == this.active_ws_index || ws.n_windows > 1)) {
                    continue;
                }

                this.ws_box = new St.Bin({ visible: true, reactive: true, can_focus: true, track_hover: true });
                this.ws_box.style_class = 'workspace-box';

                this.ws_box.label = new St.Label({ y_align: Clutter.ActorAlign.CENTER });

                if (ws_index == this.active_ws_index) {
                    this.ws_box.style_class += ' workspace-active';
                }

                if (this.workspaces_names[ws_index]) {
                    this.ws_box.label.set_text(this.workspaces_names[ws_index]);
                } else {
                    this.ws_box.label.set_text(`${ws_index + 1} (${ws.n_windows - 1} w)`);
                }

                this.ws_box.set_child(this.ws_box.label);
                this.ws_box.connect('button-release-event', () => this._toggle_ws(ws_index));
                this.ws_box.connect('touch-event', () => this._toggle_ws(ws_index));
                this.ws_bar.add_actor(this.ws_box);
            }
        }

        // activate workspace or show overview
        _toggle_ws(ws_index) {
            if (global.workspace_manager.get_active_workspace_index() == ws_index) {
                // Main.overview.toggle();
            } else {
                global.workspace_manager.get_workspace_by_index(ws_index).activate(global.get_current_time());
            }
        }
    });

class Extension {
    constructor() {
    }

    enable() {
        this.workspaces_bar = new WorkspacesBar();
        Main.panel.addToStatusArea('workspaces-bar', this.workspaces_bar, 2, 'left');
    }

    disable() {
        this.workspaces_bar._destroy();
    }
}

function init() {
    return new Extension();
}

