import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeDocsApiCall} from '../utils/docs-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases(
	{
		title: z.string().describe('The title of the new document'),
	},
	{},
);

const outputSchema = z.object({
	documentId: z.string(),
	title: z.string().optional(),
	revisionId: z.string().optional(),
}).passthrough();

export function registerDocumentCreate(server: McpServer, config: Config): void {
	server.registerTool(
		'document_create',
		{
			title: 'Create document',
			description: 'Create a new blank Google Doc with the specified title.',
			inputSchema,
			outputSchema,
		},
		async ({title}) => {
			const result = await makeDocsApiCall('POST', '/documents', config.token, {title});
			return jsonResult(outputSchema.parse(result));
		},
	);
}
