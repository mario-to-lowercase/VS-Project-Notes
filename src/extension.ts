import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
	const provider = new NotesSidebarProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('notesSidebar', provider)
	);
}

export function deactivate() { }

class NotesSidebarProvider implements vscode.WebviewViewProvider {
	private extensionUri: vscode.Uri;
	private webviewView?: vscode.WebviewView;

	constructor(private context: vscode.ExtensionContext) {
		this.extensionUri = context.extensionUri;
	}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		try {
			this.webviewView = webviewView;
			webviewView.webview.options = { enableScripts: true };

			this.updateWebview(webviewView.webview);

			webviewView.webview.onDidReceiveMessage(async (message) => {
				switch (message.command) {
					case 'createNote':
						this.createNote(message.noteName, message.content);
						break;
					case 'saveNote':
						this.saveNote(message.noteName, message.content);
						break;
					case 'fetchNotes':
						this.sendNotesToWebview();
						break;
					case 'fetchNote':
						this.sendNoteContentToWebview(message.noteName);
						break;
					default:
						console.log("Unknown command received:", message);
				}
			});

		} catch (error) {
			console.error('Error in resolveWebviewView:', error);
		}
	}

	private updateWebview(webview: vscode.Webview) {
		try {
			const htmlContent = this.getWebviewContent(webview, this.extensionUri);
			webview.html = htmlContent;
			this.sendNotesToWebview();
		} catch (error) {
			console.error('Error updating webview:', error);
		}
	}

	private createNote(noteName: string, content: string) {
		const filePath = getNotesFilePath(`${noteName}.md`);
		if (fs.existsSync(filePath)) {
			vscode.window.showWarningMessage('Note already exists.');
			return;
		}
		fs.writeFileSync(filePath, content || `# ${noteName}\n\n`, 'utf8');
		vscode.window.showInformationMessage(`Note "${noteName}" created!`);
		this.sendNotesToWebview();
	}

	private saveNote(noteName: string, content: string) {
		const filePath = getNotesFilePath(`${noteName}.md`);
		fs.writeFileSync(filePath, content, 'utf8');
		vscode.window.showInformationMessage(`Note "${noteName}" saved!`);
	}

	private sendNotesToWebview() {
		
		if (this.webviewView) {
			const notes = getAllNotes();
			this.webviewView.webview.postMessage({ command: 'updateNotesList', notes });
		}else{
			vscode.window.showErrorMessage('Webview not found.');
		}
	}

	private sendNoteContentToWebview(noteName: string) {
		const filePath = getNotesFilePath(`${noteName}.md`);
		if (fs.existsSync(filePath)) {
			const content = fs.readFileSync(filePath, 'utf8');
			if (this.webviewView) {
				this.webviewView.webview.postMessage({ command: 'displayNote', noteName, content });
			}
		} else {
			vscode.window.showWarningMessage(`Note "${noteName}" not found.`);
		}
	}

	private getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
		const indexPath = vscode.Uri.joinPath(extensionUri, 'src', 'view.html');
		return fs.readFileSync(indexPath.fsPath, 'utf8');
	}
}

// Utility functions
function getNotesFolderPath(): string {
	const notesFolder = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.notes');
	if (!fs.existsSync(notesFolder)) {
		fs.mkdirSync(notesFolder);
	}
	return notesFolder;
}

function getNotesFilePath(fileName: string): string {
	return path.join(getNotesFolderPath(), fileName);
}

function getAllNotes(): string[] {
	try {
		const notesFolder = getNotesFolderPath();
		if (!fs.existsSync(notesFolder)) {
			console.warn('Notes folder does not exist.');
			return [];
		}
		return fs.readdirSync(notesFolder)
			.filter(file => file.endsWith('.md'))
			.map(file => file.replace('.md', ''));
	} catch (error) {
		console.error('Error getting notes:', error);
		return [];
	}
}
