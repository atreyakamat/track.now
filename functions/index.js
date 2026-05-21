const functions = require('firebase-functions')
const admin = require('firebase-admin')
const stripeLib = require('stripe')
const express = require('express')
const cors = require('cors')

admin.initializeApp()

const app = express()
app.use(cors({ origin: true }))

const isProduction = process.env.NODE_ENV === 'production'
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || (isProduction ? '' : 'sk_test_mock')
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || (isProduction ? '' : 'whsec_mock')
const stripe = stripeSecretKey ? stripeLib(stripeSecretKey) : null

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) {
    console.error('Stripe webhook is not configured')
    return res.status(500).send('Stripe webhook is not configured')
  }

  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, stripeWebhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).send({ received: true })
  }

  const session = event.data.object
  const userId = session.client_reference_id || session.metadata?.userId
  const plan = session.metadata?.plan || 'pro'

  if (!userId) {
    console.warn('Stripe checkout session completed without a userId')
    return res.status(200).send({ received: true })
  }

  try {
    await admin.firestore().collection('users').doc(userId).set(
      { plan: plan },
      { merge: true }
    )
    console.log(`Successfully upgraded user ${userId} to ${plan}`)
    return res.status(200).send({ received: true })
  } catch (dbError) {
    console.error('Error updating user plan:', dbError)
    return res.status(500).send('Failed to update subscription state')
  }
})

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Create a Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).send({ error: 'Stripe is not configured' })
    }

    const { plan, userId } = req.body

    if (!plan || !userId) {
      return res.status(400).send({ error: 'Missing plan or userId' })
    }

    // Mock logic for prices - in reality, these should be created in Stripe Dashboard
    const prices = {
      pro: 'price_mock_pro',
      family: 'price_mock_family'
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: prices[plan] || prices.pro,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `https://tracknow.app/#/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://tracknow.app/#/pricing`,
      client_reference_id: userId,
      metadata: {
        userId,
        plan
      }
    })

    res.send({ id: session.id, url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    res.status(500).send({ error: error.message })
  }
})

exports.api = functions.https.onRequest(app)
