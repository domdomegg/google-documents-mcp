import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeDocsApiCall} from '../utils/docs-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases(
	{
		documentId: z.string().describe('The ID of the document to insert into'),
		text: z.string().describe('The text to insert'),
		index: z.number().describe('The zero-based index where to insert the text. Index 1 is the beginning of the document body (index 0 is reserved).'),
		segmentId: z.string().optional().describe('The ID of the header, footer, or footnote to insert into. Leave empty for the main body.'),
	},
	{},
);

const outputSchema = z.object({
	documentId: z.string(),
	replies: z.array(z.unknown()).optional(),
}).passthrough();

export function registerDocumentInsert(server: McpServer, config: Config): void {
	server.registerTool(
		'document_insert',
		{
			title: 'Insert into document',
			description: 'Insert text at a specific location in a Google Doc. Use document_get to find the appropriate index. Index 1 is the beginning of the document body.',
			inputSchema,
			outputSchema,
		},
		async ({documentId, text, index, segmentId}) => {
			const location: {index: number; segmentId?: string} = {index};
			if (segmentId) {
				location.segmentId = segmentId;
			}

			const requests = [
				{
					insertText: {
						text,
						location,
					},
				},
			];

			const result = await makeDocsApiCall('POST', `/documents/${documentId}:batchUpdate`, config.token, {requests});
			return jsonResult(outputSchema.parse(result));
		},
	);
}
