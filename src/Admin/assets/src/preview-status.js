import { timeoutWarning } from "./error-warning"

const previewStatusQuery = /* GraphQL */ `
	query PREVIEW_STATUS_QUERY($postId: Float!) {
		wpGatsby {
			gatsbyPreviewStatus(nodeId: $postId) {
				pageNode {
					path
				}
				statusType
			}
		}
	}
`

/**
 * This function checks the preview status that Gatsby has stored in post meta for
 * the parent post of this preview
 * When the preview is ready, it calls onPreviewReadyUpdateUI() which updates the UI
 *
 * If a status besides PREVIEW_READY comes back, we wait a bit and try again
 */
export async function fetchPreviewStatusAndUpdateUI({
	refetchCount = 0,
	refetchDelay = 500,
} = {}) {
	// Ask WPGraphQL for the status of this preview
	// Gatsby will update this when the preview is ready
	const response = await (
		await fetch(`/?${initialState.graphqlEndpoint}`, {
			method: "POST",
			body: JSON.stringify({
				query: previewStatusQuery,
				variables: {
					postId: initialState.postId,
				},
			}),
			headers: {
				"Content-Type": "application/json",
			},
		})
	).json()

	const { statusType } = response?.data?.wpGatsby?.gatsbyPreviewStatus || {}

	if (statusType === `PREVIEW_READY`) {
		// we clear this timeout when the preview is ready so that the
		// long preview time warning doesn't appear
		clearTimeout(timeoutWarning)

		onPreviewReadyUpdateUI(response)

		// if the preview is ready we don't need to continue
		return
	}

	const refetchDelayMap = {
		// after 30 retries of 500ms, start checking every second
		30: 1000,
		// after 20 more retries of 1 second, start checking every 2 seconds
		50: 2000,
		// after 20 more retries of 2 seconds, start checking every 5 seconds
		70: 5000,
	}

	refetchCount++
	// our delay increases if we have a value for the current refetchCount
	refetchDelay = refetchDelayMap[refetchCount] || refetchDelay

	setTimeout(() => {
		console.log({ previewStatusCheck: { response, refetchCount, refetchDelay } })
		console.log(`Preview not yet updated, retrying...`)

		fetchPreviewStatusAndUpdateUI({
			refetchCount,
			refetchDelay,
		})
	}, refetchDelay)
}

function onPreviewReadyUpdateUI(response) {
	const { gatsbyPreviewStatus } = response?.data?.wpGatsby || {}

	console.log({ previewReady: { gatsbyPreviewStatus } })

	if (
		!gatsbyPreviewStatus ||
		!gatsbyPreviewStatus.statusType ||
		!gatsbyPreviewStatus?.pageNode?.path
	) {
		throw Error(`Received an improper response from the Preview server.`)
	}

	const previewIframe = document.getElementById("preview")

	// when the iframe loads we want our iframe loaded to fire
	// so we can remove the loader
	previewIframe.addEventListener("load", onIframeLoadedHideLoaderUI)

	// point the iframe at the frontend preview url for this preview
	previewIframe.src =
		initialState.previewFrontendUrl + gatsbyPreviewStatus.pageNode.path
}

function onIframeLoadedHideLoaderUI() {
	const loader = document.getElementById("loader")

	// this delay prevents a flash between
	// the iframe painting and the loader dissapearing
	setTimeout(() => {
		// there is a fadeout css animation on this
		loader.classList.add("loaded")

		setTimeout(() => {
			// we wait a sec to display none so the css animation fadeout can complete
			loader.style.display = "none"
		}, 100)
	}, 50)
}