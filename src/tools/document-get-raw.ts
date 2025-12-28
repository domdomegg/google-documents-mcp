import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeDocsApiCall} from '../utils/docs-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases(
	{
		documentId: z.string().describe('The ID of the document to retrieve'),
		suggestionsViewMode: z.enum(['DEFAULT_FOR_CURRENT_ACCESS', 'SUGGESTIONS_INLINE', 'PREVIEW_SUGGESTIONS_ACCEPTED', 'PREVIEW_WITHOUT_SUGGESTIONS']).optional().describe('The suggestions view mode to apply to the document'),
	},
	{},
);

// Recursive schema for document structure elements
const textStyleSchema = z.object({
	bold: z.boolean().optional(),
	italic: z.boolean().optional(),
	underline: z.boolean().optional(),
	strikethrough: z.boolean().optional(),
	fontSize: z.object({
		magnitude: z.number().optional(),
		unit: z.string().optional(),
	}).optional(),
	foregroundColor: z.unknown().optional(),
	backgroundColor: z.unknown().optional(),
	link: z.object({
		url: z.string().optional(),
		bookmarkId: z.string().optional(),
		headingId: z.string().optional(),
	}).optional(),
}).passthrough();

const textRunSchema = z.object({
	content: z.string().optional(),
	textStyle: textStyleSchema.optional(),
});

const paragraphElementSchema = z.object({
	startIndex: z.number().optional(),
	endIndex: z.number().optional(),
	textRun: textRunSchema.optional(),
	autoText: z.unknown().optional(),
	pageBreak: z.unknown().optional(),
	columnBreak: z.unknown().optional(),
	footnoteReference: z.unknown().optional(),
	horizontalRule: z.unknown().optional(),
	equation: z.unknown().optional(),
	inlineObjectElement: z.unknown().optional(),
	person: z.unknown().optional(),
	richLink: z.unknown().optional(),
}).passthrough();

const paragraphStyleSchema = z.object({
	headingId: z.string().optional(),
	namedStyleType: z.string().optional(),
	alignment: z.string().optional(),
	lineSpacing: z.number().optional(),
	direction: z.string().optional(),
	spacingMode: z.string().optional(),
	spaceAbove: z.unknown().optional(),
	spaceBelow: z.unknown().optional(),
	borderBetween: z.unknown().optional(),
	borderTop: z.unknown().optional(),
	borderBottom: z.unknown().optional(),
	borderLeft: z.unknown().optional(),
	borderRight: z.unknown().optional(),
	indentFirstLine: z.unknown().optional(),
	indentStart: z.unknown().optional(),
	indentEnd: z.unknown().optional(),
	tabStops: z.array(z.unknown()).optional(),
	keepLinesTogether: z.boolean().optional(),
	keepWithNext: z.boolean().optional(),
	avoidWidowAndOrphan: z.boolean().optional(),
	shading: z.unknown().optional(),
	pageBreakBefore: z.boolean().optional(),
}).passthrough();

const paragraphSchema = z.object({
	elements: z.array(paragraphElementSchema).optional(),
	paragraphStyle: paragraphStyleSchema.optional(),
	bullet: z.unknown().optional(),
	positionedObjectIds: z.array(z.string()).optional(),
});

const structuralElementSchema = z.object({
	startIndex: z.number().optional(),
	endIndex: z.number().optional(),
	paragraph: paragraphSchema.optional(),
	sectionBreak: z.unknown().optional(),
	table: z.unknown().optional(),
	tableOfContents: z.unknown().optional(),
}).passthrough();

const bodySchema = z.object({
	content: z.array(structuralElementSchema).optional(),
});

// Tab schema
const tabSchema = z.object({
	tabProperties: z.object({
		tabId: z.string().optional(),
		title: z.string().optional(),
		index: z.number().optional(),
		nestingLevel: z.number().optional(),
		parentTabId: z.string().optional(),
	}).passthrough().optional(),
	documentTab: z.object({
		body: bodySchema.optional(),
		headers: z.record(z.unknown()).optional(),
		footers: z.record(z.unknown()).optional(),
		footnotes: z.record(z.unknown()).optional(),
		documentStyle: z.unknown().optional(),
		namedStyles: z.unknown().optional(),
		inlineObjects: z.record(z.unknown()).optional(),
		positionedObjects: z.record(z.unknown()).optional(),
	}).passthrough().optional(),
	childTabs: z.array(z.unknown()).optional(),
}).passthrough();

const outputSchema = z.object({
	documentId: z.string(),
	title: z.string().optional(),
	tabs: z.array(tabSchema).optional(),
	revisionId: z.string().optional(),
	suggestionsViewMode: z.string().optional(),
}).passthrough();

export function registerDocumentGetRaw(server: McpServer, config: Config): void {
	server.registerTool(
		'document_get_raw',
		{
			title: 'Get document (raw)',
			description: 'Get the full raw JSON structure of a Google Doc, including all tabs, formatting, headers, footers, and styles. Google Docs content is organized under tabs - body content is at tabs[].documentTab.body.content, not at the top level. Warning: responses can be very large. Consider using jq to extract specific fields, or use document_get_text for plain text content.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({documentId, suggestionsViewMode}) => {
			const params = new URLSearchParams();
			params.set('includeTabsContent', 'true');
			if (suggestionsViewMode) {
				params.set('suggestionsViewMode', suggestionsViewMode);
			}

			const result = await makeDocsApiCall('GET', `/documents/${documentId}?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}
