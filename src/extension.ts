import * as vscode from 'vscode';
import { EditLogger } from './EditLogger';
import { SidebarProvider } from './sidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    const logger = new EditLogger(context);
    const sidebarProvider = new SidebarProvider(logger);
    
    vscode.window.registerTreeDataProvider('editLoggerSidebar', sidebarProvider);
    
    context.subscriptions.push(
        logger,
        vscode.commands.registerCommand('editLogger.refreshSidebar', () => {
            sidebarProvider.refresh();
        })
    );
}

export function deactivate() {}