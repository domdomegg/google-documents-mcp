import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeDocsApiCall} from '../utils/docs-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases(
	{
		documentId: z.string().describe('The ID of the document'),
		findText: z.string().describe('The text to search for'),
		replaceText: z.string().describe('The text to replace matches with'),
		matchCase: z.boolean().optional().default(false).describe('Whether the search should be case-sensitive'),
	},
	{},
);

const outputSchema = z.object({
	documentId: z.string(),
	replies: z.array(z.object({
		replaceAllText: z.object({
			occurrencesChanged: z.number().optional(),
		}).optional(),
	})).optional(),
}).passthrough();

export function registerDocumentReplace(server: McpServer, config: Config): void {
	server.registerTool(
		'document_replace',
		{
			title: 'Find and replace in document',
			description: 'Find and replace all occurrences of text in a Google Doc. Returns the number of replacements made.',
			inputSchema,
			outputSchema,
		},
		async ({documentId, findText, replaceText, matchCase}) => {
			const requests = [
				{
					replaceAllText: {
						containsText: {
							text: findText,
							matchCase,
						},
						replaceText,
					},
				},
			];

			const result = await makeDocsApiCall('POST', `/documents/${documentId}:batchUpdate`, config.token, {requests});
			return jsonResult(outputSchema.parse(result));
		},
	);
}
