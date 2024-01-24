//@ts-check
const createBillingRequest = async (amount: string, currency: string) => {
	const options = {
		method: "POST",
		url: `PRODUCTION_URL/billing_requests`,
		headers: {
			Authorization: `Bearer TOKEN`,
			"GoCardless-Version": "2015-07-06",
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		data: {
			billing_requests: {
				payment_request: {
					description: "Medicard Assistant Order",
					amount: (+amount * 100).toFixed(2),
					currency,
				},
				mandate_request: {
					description: "Medicard Assistant Order",
					scheme: "pay_to",
				},
				purpose_code: "other",
			},
		},
	};

	const res = await axios.request(options);

	const {
		id,
		links: { mandate_request },
	} = res.data.billing_requests;

	return { billing_id: id, orderId: mandate_request };
};

const createBillingFlow = async (billing_id: string, orderId: string) => {
	const flowOptions = {
		method: "POST",
		url: `PRODUCTION_URL/billing_request_flows`,
		headers: {
			Authorization: `Bearer TOKEN`,
			"GoCardless-Version": "2015-07-06",
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		data: {
			billing_request_flows: {
				redirect_uri: `https://medicardassistant.com/order-confirmation/pending?orderId=${orderId}`,
				exit_uri: "https://medicardassistant.com/apply",
				links: {
					billing_request: billing_id,
				},
			},
		},
	};
	try {
		const res = await axios.request(flowOptions);
		return res?.data.billing_request_flows.authorisation_url;
	} catch (error) {
		this.logger.error("BILLING FLOW", error?.response?.data?.error?.errors);
	}
};

const gcWebhook = async (event: any) => {
	if (!event) return;

	const { action, resource_type, links } = event;
	if (resource_type === "payments" && action === "confirmed") {
		const payment = await this.getPaymentStatus(links.payment);

		const id = payment.reference;

		if (!id) {
			return { status: "No payment with such id" };
		}

		const order = await this.prismaService.order.update({
			where: { orderId: id },
			data: { status: E_Order_Status.COMPLETED },
		});

		if (order.status === E_Order_Status.COMPLETED) {
			this.eventEmitter.emit("order.created", order);
		}

		return { status: "Order status updated" };
	}
};

const getPaymentStatus = async (paymentId: string) => {
	const options = {
		method: "GET",
		url: `PRODUCTION_URL/payments/${paymentId}`,
		headers: {
			Authorization: `Bearer TOKEN`,
			"GoCardless-Version": "2015-07-06",
			Accept: "application/json",
			"Content-Type": "application/json",
		},
	};

	try {
		const res = await axios.request(options);

		return res?.data?.payments;
	} catch (error) {
		this.logger.error(
			"Failed to find payment",
			error?.response?.data?.error?.message
		);
	}
};
