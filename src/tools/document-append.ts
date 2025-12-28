import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeDocsApiCall} from '../utils/docs-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases(
	{
		documentId: z.string().describe('The ID of the document to append to'),
		text: z.string().describe('The text to append to the end of the document'),
	},
	{},
);

const outputSchema = z.object({
	documentId: z.string(),
	replies: z.array(z.unknown()).optional(),
}).passthrough();

export function registerDocumentAppend(server: McpServer, config: Config): void {
	server.registerTool(
		'document_append',
		{
			title: 'Append to document',
			description: 'Append text to the end of a Google Doc. This is a convenience wrapper around batch_update that inserts text at the end of the document body.',
			inputSchema,
			outputSchema,
		},
		async ({documentId, text}) => {
			const requests = [
				{
					insertText: {
						text,
						endOfSegmentLocation: {
							segmentId: '', // Empty string means the body
						},
					},
				},
			];

			const result = await makeDocsApiCall('POST', `/documents/${documentId}:batchUpdate`, config.token, {requests});
			return jsonResult(outputSchema.parse(result));
		},
	);
}
