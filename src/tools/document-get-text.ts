import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeDocsApiCall} from '../utils/docs-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases(
	{
		documentId: z.string().describe('The ID of the document to retrieve'),
	},
	{},
);

const tabTextSchema = z.object({
	tabId: z.string(),
	title: z.string(),
	text: z.string(),
});

const outputSchema = z.object({
	documentId: z.string(),
	title: z.string(),
	tabs: z.array(tabTextSchema),
});

type BodyContent = {paragraph?: {elements?: {textRun?: {content?: string}}[]}}[];
type Tab = {
	tabProperties?: {tabId?: string; title?: string};
	documentTab?: {body?: {content?: BodyContent}};
	childTabs?: Tab[];
};

// Helper to extract text from body content
function extractTextFromBody(content: BodyContent): string {
	let text = '';
	for (const element of content) {
		if (element.paragraph?.elements) {
			for (const paragraphElement of element.paragraph.elements) {
				if (paragraphElement.textRun?.content) {
					text += paragraphElement.textRun.content;
				}
			}
		}
	}

	return text;
}

// Helper to recursively extract text from all tabs
function extractTabsText(tabs: Tab[]): {tabId: string; title: string; text: string}[] {
	const results: {tabId: string; title: string; text: string}[] = [];

	for (const tab of tabs) {
		const tabId = tab.tabProperties?.tabId ?? '';
		const title = tab.tabProperties?.title ?? '';
		const content = tab.documentTab?.body?.content ?? [];
		const text = extractTextFromBody(content);

		results.push({tabId, title, text});

		// Recursively process child tabs
		if (tab.childTabs?.length) {
			results.push(...extractTabsText(tab.childTabs));
		}
	}

	return results;
}

export function registerDocumentGetText(server: McpServer, config: Config): void {
	server.registerTool(
		'document_get_text',
		{
			title: 'Get document text',
			description: 'Get the plain text content of a Google Doc without formatting, including all tabs. Google Docs content is organized under tabs (at tabs[].documentTab.body.content in the raw API), but this tool extracts and flattens the text for you. For very long documents, consider writing output to a file and reading specific sections.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({documentId}) => {
			const params = new URLSearchParams();
			params.set('includeTabsContent', 'true');

			const result = await makeDocsApiCall('GET', `/documents/${documentId}?${params.toString()}`, config.token);
			const doc = result as {documentId: string; title?: string; tabs?: Tab[]};

			const tabs = doc.tabs ? extractTabsText(doc.tabs) : [];

			return jsonResult({
				documentId: doc.documentId,
				title: doc.title ?? '',
				tabs,
			});
		},
	);
}
