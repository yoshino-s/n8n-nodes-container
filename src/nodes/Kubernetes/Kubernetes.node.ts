import {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeExecutionWithMetadata,
	NodeOperationError,
} from "n8n-workflow";

import { K8SClient } from "./utils";

export class Kubernetes implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Kubernetes",
		name: "kubernetes",
		icon: "file:k8s.svg",
		group: ["output"],
		version: 1,
		subtitle:
			'={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: "Interact with Kubernetes",
		defaults: {
			name: "Kubernetes",
		},
		inputs: ["main"],
		outputs: ["main"],
		credentials: [
			{
				name: "kubernetesCredentialsApi",
				required: true,
			},
		],
		properties: [
			{
				displayName: "Operation",
				name: "operation",
				type: "options",
				noDataExpression: true,
				options: [
					{
						name: "Run",
						value: "run",
					},
				],
				default: "run",
			},
			{
				displayName: "Image",
				name: "image",
				type: "string",
				default: "",
				displayOptions: {
					show: {
						operation: ["run"],
					},
				},
			},
			{
				displayName: "Command",
				name: "command",
				type: "json",
				default: "[]",
				displayOptions: {
					show: {
						operation: ["run"],
					},
				},
			},
			{
				displayName: "Namespace",
				name: "namespace",
				type: "string",
				default: "default",
				displayOptions: {
					show: {
						operation: ["run"],
					},
				},
			},
		],
	};
	async execute(
		this: IExecuteFunctions
	): Promise<INodeExecutionData[][] | NodeExecutionWithMetadata[][]> {
		const result: INodeExecutionData[] = [];
		for (let idx = 0; idx < this.getInputData().length; idx++) {
			const credentials = await this.getCredentials(
				"kubernetesCredentialsApi",
				idx
			);
			if (credentials === undefined) {
				throw new NodeOperationError(
					this.getNode(),
					"No credentials got returned!"
				);
			}
			const k8s = new K8SClient(credentials, this);
			let data: IDataObject = undefined;
			const operation = this.getNodeParameter("operation", idx) as string;

			if (operation === "run") {
				const image = this.getNodeParameter("image", idx) as string;
				const command = JSON.parse(
					this.getNodeParameter("command", idx) as any
				);
				const namespace =
					(this.getNodeParameter("namespace", idx) as string) ??
					"default";
				if (!Array.isArray(command)) {
					throw new NodeOperationError(
						this.getNode(),
						"Command must be an array!"
					);
				}

				data = {
					stdout: await k8s.runPodAndGetOutput(
						image,
						command,
						undefined,
						namespace
					),
				};
			}

			result.push(
				...this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(data),
					{ itemData: { item: idx } }
				)
			);
		}

		return [result];
	}
}
