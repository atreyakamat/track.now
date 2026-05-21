const functions = require('firebase-functions')
const admin = require('firebase-admin')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock')
const express = require('express')
const cors = require('cors')

admin.initializeApp()

const app = express()
app.use(cors({ origin: true }))

// Create a Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  try {
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

// Webhook to handle successful payments
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock'

  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret)
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.client_reference_id
    const plan = session.metadata?.plan || 'pro'

    if (userId) {
      try {
        await admin.firestore().collection('users').doc(userId).set(
          { plan: plan },
          { merge: true }
        )
        console.log(`Successfully upgraded user ${userId} to ${plan}`)
      } catch (dbError) {
        console.error('Error updating user plan:', dbError)
      }
    }
  }

  res.send()
})

exports.api = functions.https.onRequest(app)
