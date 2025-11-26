import React, { useState } from "react"
import { Container, Row, Col, Button, Spinner, Alert } from "react-bootstrap"
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useOrganization } from "../../contexts/OrganizationContext"
import { ref, get } from "firebase/database"

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function UserAnalytics() {
  const { orgFunctions, orgDB } = useOrganization()
  const [analyticsData, setAnalyticsData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function fetchAnalyticsData() {
    try {
      setLoading(true)
      setError(null)


      const functionUrl = `http://localhost:5001/clas-demo-2/us-central1/get30DayAnalytics`

      console.log("Fetching from:", functionUrl)

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("Analytics data received:", data)
      setAnalyticsData(data)
    } catch (err) {
      console.error("Error fetching analytics:", err)
    } finally {
      setLoading(false)
    }
  }

  // Transform daily unique users data for chart
  const getDailyUsersChartData = () => {
    if (!analyticsData?.dailyUniqueUsers) return []

    const dailyPlatform = analyticsData.dailyPlatformUsers || {}

    // Generate all 30 days
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 30)

    const allDays = []
    const current = new Date(start)

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0] // YYYY-MM-DD format
      const d = new Date(dateKey)

      allDays.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        fullDate: dateKey,
        total: analyticsData.dailyUniqueUsers[dateKey] || 0,
        iOS: dailyPlatform[dateKey]?.ios || 0,
        Android: dailyPlatform[dateKey]?.android || 0
      })

      current.setDate(current.getDate() + 1)
    }

    return allDays
  }

  // Transform platform distribution data for pie chart
  const getPlatformChartData = () => {
    if (!analyticsData?.platformDistribution) return []

    return Object.entries(analyticsData.platformDistribution).map(([platform, count]) => ({
      name: platform.toUpperCase(),
      value: count
    }))
  }

  // Transform version distribution data for bar chart
  const getVersionChartData = () => {
    if (!analyticsData?.versionDistribution) return []

    return Object.entries(analyticsData.versionDistribution)
      .map(([version, count]) => ({
        version,
        users: count
      }))
      .sort((a, b) => b.users - a.users) // Sort by user count descending
      .slice(0, 10) // Show top 10 versions
  }

  // Transform view distribution data for bar chart
  const getViewChartData = () => {
    if (!analyticsData?.viewDistribution) return []

    return Object.entries(analyticsData.viewDistribution)
      .map(([viewId, count]) => ({
        viewId,
        views: count
      }))
      .sort((a, b) => b.views - a.views) // Sort by view count descending
      .slice(0, 15) // Show top 15 views
  }

  const analyticsRef = ref(orgDB, `analytics/asuDaily`)
    onValue(analyticsRef,(snapshot) => {
      const data = snapshot.val()
      console.log(data)
    })

  return (
    <Container style={{ marginTop: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>User Analytics - Last 30 Days</h2>
        <Button
          variant="primary"
          onClick={fetchAnalyticsData}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
                style={{ marginRight: "8px" }}
              />
              Loading...
            </>
          ) : (
            "Generate Analytics"
          )}
        </Button>
      </div>


      {analyticsData && (
        <>
          <div style={{ marginTop: "10px", marginBottom: "20px", fontSize: "14px", color: "#666" }}>
            <strong>Total Unique Users:</strong> {analyticsData.totalUniqueUsers}
          </div>

          <Row style={{ marginTop: "30px" }}>
            <Col>
              <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "5px", marginBottom: "20px" }}>
                <h4>Daily Active Users</h4>
                <p style={{ fontSize: "14px", color: "#666" }}>Unique users who opened the app each day (Last 30 Days)</p>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: "1200px", height: "550px" }}>
                    <ResponsiveContainer width="100%" height={550}>
                      <LineChart data={getDailyUsersChartData()} margin={{ bottom: 90, left: 10, right: 30, top: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          angle={-45}
                          textAnchor="end"
                          height={120}
                          interval={0}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total" name="Total Users" stroke="#8884d8" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="iOS" name="iOS Users" stroke="#82ca9d" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="Android" name="Android Users" stroke="#ffc658" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "5px", marginBottom: "20px" }}>
                <h4>Platform Distribution</h4>
                <p style={{ fontSize: "14px", color: "#666" }}>Android vs iOS users</p>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getPlatformChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getPlatformChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Col>
            <Col md={6}>
              <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "5px", marginBottom: "20px" }}>
                <h4>App Version Distribution</h4>
                <p style={{ fontSize: "14px", color: "#666" }}>Latest app versions in use (Top 10)</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getVersionChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="version" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="users" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Col>
          </Row>

          <Row style={{ marginTop: "20px" }}>
            <Col>
              <div style={{ padding: "20px", border: "1px solid #ddd", borderRadius: "5px", marginBottom: "20px" }}>
                <h4>App View Distribution</h4>
                <p style={{ fontSize: "14px", color: "#666" }}>Most viewed content (Top 15 ViewIds)</p>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: "800px", height: "400px" }}>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={getViewChartData()} margin={{ bottom: 100, left: 10, right: 30, top: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="viewId"
                          angle={-45}
                          textAnchor="end"
                          height={130}
                          interval={0}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="views" name="View Count" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </>
      )}
    </Container>
  )
}
