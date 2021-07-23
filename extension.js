/* 
    Workspaces Bar
    Copyright Francois Thirioux 2021
    GitHub contributors: @fthx
    License GPL v3
*/


const { Clutter, Gio, GObject, Shell, St } = imports.gi;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const PANEL_ICON_SIZE = imports.ui.panel.PANEL_ICON_SIZE;
const APP_MENU_ICON_MARGIN = imports.ui.panel.APP_MENU_ICON_MARGIN;

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


            // FIXME probably a bad idea
            // but Gnome documentation is horrible
            // so no idea if there is a better way
            const AppSystem = Shell.AppSystem.get_default();

            let app_map = new Map();  // window id -> app

            AppSystem.get_running().forEach((app) => {
                app.get_windows().forEach((window) => {
                    app_map.set(window.get_id(), app);
                })
            });

            // get number of workspaces
            this.ws_count = global.workspace_manager.get_n_workspaces();
            this.active_ws_index = global.workspace_manager.get_active_workspace_index();
            
            let is_first_workspace = true;

            // display all current workspaces buttons
            for (let ws_index = 0; ws_index < this.ws_count; ++ws_index) {

                let ws = global.workspace_manager.get_workspace_by_index(ws_index);

                // only show non-empty workspaces
                // or the currently active one
                if (!(ws_index == this.active_ws_index || ws.n_windows > 1)) {
                    continue;
                }

                this.ws_box = new St.BoxLayout({ visible: true, reactive: true, can_focus: true, track_hover: true });
                this.ws_box.style_class = 'workspace-box';

                if (is_first_workspace) {
                    this.ws_box.style_class += ' workspace-first';
                    is_first_workspace = false;
                }

                if (ws_index == this.active_ws_index) {
                    this.ws_box.style_class += ' workspace-active';
                }

                let s = new Set();
                ws.list_windows().forEach((window) => {
                    let app = app_map.get(window.get_id());

                    if (!app) return;

                    s.add(app)
                });

                this.ws_box.label = new St.Label({ y_align: Clutter.ActorAlign.CENTER });
                this.ws_box.label.set_text(`${ws_index + 1}${s.size > 0 ? ": " : ""}`);
                this.ws_box.add_child(this.ws_box.label);

                let multiple_boxes = false;

                s.forEach((app) => {
                    let icon_box = new St.Bin({ y_align: Clutter.ActorAlign.CENTER });

                    if (multiple_boxes) {
                        icon_box.style_class = "workspace-icon-box-multiple";
                    }
                    multiple_boxes = true;

                    // see https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/ca32abc15099507a5c6d2d6a808cb7ba5151fcd1/js/ui/panel.js#L255
                    const icon = app.create_icon_texture(PANEL_ICON_SIZE - APP_MENU_ICON_MARGIN);
                    icon_box.set_child(icon);
                    
                    this.ws_box.add_child(icon_box);
                });

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

