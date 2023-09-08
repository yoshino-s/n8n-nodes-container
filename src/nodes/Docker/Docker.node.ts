import { Writable } from "node:stream";

import Dockerode from "dockerode";
import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeExecutionWithMetadata,
	NodeOperationError,
} from "n8n-workflow";

async function run(
	docker: Dockerode,
	image: string,
	cmd: string[],
	createOptions?: Dockerode.ContainerCreateOptions,
	startOptions?: Dockerode.ContainerStartOptions
) {
	let stdout = "";
	let stderr = "";

	const outStream = new Writable({
		write(chunk, encoding, done) {
			stdout += chunk.toString();
			done();
		},
	});

	const errStream = new Writable({
		write(chunk, encoding, done) {
			stderr += chunk.toString();
			done();
		},
	});

	await docker.run(
		image,
		cmd,
		[outStream, errStream],
		{
			...createOptions,
			Tty: false,
		},
		startOptions
	);

	return { stdout, stderr };
}

export class Docker implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Docker",
		name: "docker",
		icon: "file:docker.svg",
		group: ["output"],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: "Interact with Docker",
		defaults: {
			name: "Docker",
		},
		inputs: ["main"],
		outputs: ["main"],
		credentials: [
			{
				name: "dockerCredentialsApi",
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
						name: "Get",
						value: "get",
					},
					{
						name: "List",
						value: "list",
					},
					{
						name: "Run",
						value: "run",
					},
				],
				default: "get",
			},
			{
				displayName: "Resource",
				name: "resource",
				type: "options",
				noDataExpression: true,
				options: [
					{
						name: "Container",
						value: "container",
					},
					{
						name: "Image",
						value: "image",
					},
					{
						name: "Volume",
						value: "volume",
					},
					{
						name: "Network",
						value: "network",
					},
				],
				default: "container",
				displayOptions: {
					hide: {
						operation: ["run"],
					},
				},
			},
			{
				displayName: "ID",
				name: "id",
				type: "string",
				default: "",
				displayOptions: {
					show: {
						operation: ["get"],
					},
				},
			},
			{
				displayName: "Options",
				name: "options",
				type: "json",
				default: "{}",
				displayOptions: {
					show: {
						operation: ["list"],
					},
				},
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
		],
	};
	async execute(
		this: IExecuteFunctions
	): Promise<INodeExecutionData[][] | NodeExecutionWithMetadata[][]> {
		const result: INodeExecutionData[][] = [];
		for (let idx = 0; idx < this.getInputData().length; idx++) {
			const credentials = await this.getCredentials(
				"dockerCredentialsApi",
				idx
			);
			if (credentials === undefined) {
				throw new NodeOperationError(
					this.getNode(),
					"No credentials got returned!"
				);
			}
			const docker = new Dockerode(credentials);
			let data: any = undefined;
			const operation = this.getNodeParameter("operation", idx) as string;

			if (operation === "run") {
				const image = this.getNodeParameter("image", idx) as string;
				const command = JSON.parse(
					this.getNodeParameter("command", idx) as any
				);
				if (!Array.isArray(command)) {
					throw new NodeOperationError(
						this.getNode(),
						"Command must be an array!"
					);
				}
				await docker.pull(image);

				data = await run(docker, image, command, {
					HostConfig: {
						AutoRemove: true,
					},
				});
				console.log(data);
			} else {
				const resource = this.getNodeParameter("resource", idx) as string;
				let options: any = undefined;
				if (operation === "list") {
					options = this.getNodeParameter("options", idx);
				} else {
					options = this.getNodeParameter("id", idx);
				}
				const action = `${operation}${resource[0].toUpperCase()}${resource.slice(
					1
				)}${operation === "list" ? "s" : ""}`;
				this.sendMessageToUI("credentials:" + JSON.stringify(credentials));
				this.sendMessageToUI("action:" + JSON.stringify(action));

				data = await docker[action](options);
			}

			result.push(this.helpers.returnJsonArray(data));
		}

		return result;
	}
}
