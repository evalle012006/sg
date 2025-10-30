import React, { useState } from 'react';

const TemplateHelperDocumentation = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'simple', label: 'Simple Insert' },
    { id: 'conditional', label: 'Conditionals' },
    { id: 'arrays', label: 'Arrays & Lists' },
    { id: 'tables', label: 'Tables' },
    { id: 'combinations', label: 'Combinations' },
    { id: 'helpers', label: 'All Helpers' }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Email Template Helper Guide
        </h1>
        <p className="text-gray-600">
          Learn how to use merge tags and Handlebars helpers in your email templates
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="prose max-w-none">
        {activeTab === 'overview' && <OverviewContent />}
        {activeTab === 'simple' && <SimpleInsertContent />}
        {activeTab === 'conditional' && <ConditionalContent />}
        {activeTab === 'arrays' && <ArraysContent />}
        {activeTab === 'tables' && <TablesContent />}
        {activeTab === 'combinations' && <CombinationsContent />}
        {activeTab === 'helpers' && <AllHelpersContent />}
      </div>
    </div>
  );
};

// Overview Tab Content
const OverviewContent = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Getting Started</h2>
    <p>
      Use merge tags to insert dynamic content into your email templates. 
      Merge tags are wrapped in double curly braces: <code className="bg-gray-100 px-2 py-1 rounded">{`{{tag_name}}`}</code>
    </p>

    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-4">
      <h3 className="font-semibold text-blue-900 mb-2">Quick Example</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`Hello {{guest_name}},

Your booking from {{checkin_date}} to {{checkout_date}} is confirmed!`}</code>
      </pre>
    </div>

    <h3 className="text-lg font-semibold mt-6">Four Main Insertion Methods</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-2">1. Simple Insert</h4>
        <p className="text-sm text-gray-600">Insert a single value directly</p>
        <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-2">{`{{guest_name}}`}</code>
      </div>
      
      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-2">2. Conditional</h4>
        <p className="text-sm text-gray-600">Show content only when data exists</p>
        <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-2">{`{{#if value}}...{{/if}}`}</code>
      </div>
      
      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-2">3. Bullet List</h4>
        <p className="text-sm text-gray-600">Display array items as a formatted list</p>
        <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-2">{`{{#each items}}...{{/each}}`}</code>
      </div>
      
      <div className="border rounded-lg p-4">
        <h4 className="font-semibold mb-2">4. Table</h4>
        <p className="text-sm text-gray-600">Display data in table format</p>
        <code className="text-xs bg-gray-100 px-2 py-1 rounded block mt-2">{`<table>{{#each}}...{{/each}}</table>`}</code>
      </div>
    </div>
  </div>
);

// Simple Insert Tab Content
const SimpleInsertContent = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Simple Insert</h2>
    <p>The most basic way to insert data into your template.</p>

    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold mb-2">Basic Usage</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{guest_name}}
{{guest_email}}
{{checkin_date}}`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">With Default Values</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{default guest_name "Guest"}}
{{default room_type "Standard Room"}}`}</code>
      </pre>
      <p className="text-sm text-gray-600 mt-2">
        Shows the value if it exists, otherwise shows the default text.
      </p>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">With Formatting Helpers</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{uppercase guest_name}}
{{capitalize room_type}}
{{formatDate checkin_date "DD MMMM YYYY"}}`}</code>
      </pre>
    </div>
  </div>
);

// Conditional Tab Content
const ConditionalContent = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Conditional Display</h2>
    <p>Show or hide content based on whether data exists or meets certain conditions.</p>

    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold mb-2">Basic If/Else</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{#if guest_name}}
  Hello {{guest_name}}!
{{else}}
  Hello Guest!
{{/if}}`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">Check if Not Empty</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{#if (isNotEmpty dietary_requirements)}}
  <p>Dietary Requirements: {{dietary_requirements}}</p>
{{/if}}`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">Comparison Operators</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{#if (eq room_type "Accessible")}}
  <p>This is an accessible room.</p>
{{/if}}

{{#if (gt number_of_guests 2)}}
  <p>Group booking discount applied!</p>
{{/if}}

{{#if (or has_assistance_animal requires_wheelchair)}}
  <p>Special accommodation arranged.</p>
{{/if}}`}</code>
      </pre>
    </div>

    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mt-4">
      <h4 className="font-semibold text-yellow-900 mb-2">Available Comparison Helpers</h4>
      <ul className="text-sm space-y-1">
        <li><code>eq</code> - equals</li>
        <li><code>ne</code> - not equals</li>
        <li><code>gt</code> - greater than</li>
        <li><code>lt</code> - less than</li>
        <li><code>gte</code> - greater than or equal</li>
        <li><code>lte</code> - less than or equal</li>
        <li><code>and</code> - all conditions true</li>
        <li><code>or</code> - any condition true</li>
        <li><code>not</code> - negation</li>
      </ul>
    </div>
  </div>
);

// Arrays Tab Content
const ArraysContent = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Working with Arrays & Lists</h2>
    <p>Display multiple items from arrays as formatted lists.</p>

    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold mb-2">Basic Bullet List</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{#if (isArray dietary_requirements)}}
  <ul>
    {{#each dietary_requirements}}
      <li>{{this}}</li>
    {{/each}}
  </ul>
{{/if}}`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">Numbered List with Index</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{#if (isArray mobility_equipment)}}
  <ol>
    {{#each mobility_equipment}}
      <li>{{inc @index}}. {{this}}</li>
    {{/each}}
  </ol>
{{/if}}`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">Join Array as Comma-Separated Text</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`Allergies: {{join allergies ", "}}
Equipment: {{join mobility_equipment " | "}}`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">Array Helpers</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`First item: {{first equipment_list}}
Last item: {{last equipment_list}}
Count: {{length equipment_list}} items

{{#if (isEmpty equipment_list)}}
  <p>No equipment selected</p>
{{/if}}`}</code>
      </pre>
    </div>

    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mt-4">
      <h3 className="font-semibold text-orange-900 mb-2">🔧 Working with Object Arrays (parseJSON)</h3>
      <p className="text-sm mb-3">
        If your array contains objects with properties (like <code>name</code>, <code>price</code>, <code>selected</code>), 
        you need to use <code>parseJSON</code> to access those properties:
      </p>
      <pre className="bg-white p-3 rounded overflow-x-auto text-xs">
        <code>
{`{{#if (isArray services)}}
{{#with (parseJSON services)}}
  <ul>
    {{#each this}}
      <li>
        {{this.name}} - ${'$'}{{this.price}}
        {{#if this.selected}}✓{{/if}}
      </li>
    {{/each}}
  </ul>
{{/with}}
{{/if}}`}
        </code>
      </pre>
      <p className="text-sm mt-2 text-gray-700">
        Without <code>parseJSON</code>, you can only display simple string arrays like <code>[&quot;item1&quot;, &quot;item2&quot;]</code>
      </p>
    </div>
  </div>
);

// Tables Tab Content
const TablesContent = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Displaying Data in Tables</h2>
    <p>Create structured tables from array data.</p>

    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="font-semibold mb-2">Basic Table</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto text-xs">
        <code>
{`{{#if (isArray medications)}}
<table border="1" cellpadding="8" style="border-collapse: collapse;">
  <thead>
    <tr>
      <th>Medication</th>
      <th>Dosage</th>
      <th>Frequency</th>
    </tr>
  </thead>
  <tbody>
    {{#each medications}}
    <tr>
      <td>{{this.name}}</td>
      <td>{{this.dosage}}</td>
      <td>{{this.frequency}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
{{/if}}`}
        </code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">Styled Table with Conditional Rows</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto text-xs">
        <code>
{`{{#if (isArray services)}}
{{#with (parseJSON services)}}
<table style="width: 100%; border: 1px solid #ddd;">
  <thead style="background-color: #f8f9fa;">
    <tr>
      <th style="padding: 12px; text-align: left;">Service</th>
      <th style="padding: 12px; text-align: right;">Price</th>
    </tr>
  </thead>
  <tbody>
    {{#each this}}
    {{#if this.selected}}
    <tr>
      <td style="padding: 8px;">{{this.name}}</td>
      <td style="padding: 8px; text-align: right;">
        ${'$'}{{this.price}}
      </td>
    </tr>
    {{/if}}
    {{/each}}
  </tbody>
</table>
{{/with}}
{{/if}}`}
        </code>
      </pre>
      <p className="text-sm text-gray-600 mt-2">
        💡 Use <code>parseJSON</code> if your data is stored as a JSON string
      </p>
    </div>
  </div>
);

// Combinations Tab Content
const CombinationsContent = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Combining Conditionals with Formatting</h2>
    <p>Mix conditional logic with different display formats for powerful templates.</p>

    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
      <h3 className="font-semibold text-blue-900 mb-2">💡 Key Concept</h3>
      <p className="text-sm">
        You can wrap any formatting option (simple insert, bullet list, table) 
        inside conditional blocks to show content only when data exists!
      </p>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">1. Conditional + Simple Insert</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{#if asia_scale_score}}
  <p><strong>ASIA Scale Score:</strong> {{asia_scale_score}}</p>
{{else}}
  <p><em>No score recorded</em></p>
{{/if}}`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">2. Conditional + Bullet List</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`{{#if (isNotEmpty mobility_equipment)}}
  <div style="margin: 16px 0;">
    <strong>Mobility Equipment:</strong>
    <ul style="margin-top: 8px;">
      {{#each mobility_equipment}}
        <li>{{this}}</li>
      {{/each}}
    </ul>
  </div>
{{else}}
  <p>No mobility equipment required</p>
{{/if}}`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">3. Conditional + Table</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto text-xs">
        <code>{`{{#if (isArray health_conditions)}}
{{#with (parseJSON health_conditions)}}
  <h3>Health Conditions</h3>
  <table border="1" cellpadding="8">
    <thead>
      <tr>
        <th>Condition</th>
        <th>Severity</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      {{#each this}}
      <tr>
        <td>{{this.name}}</td>
        <td>{{capitalize this.severity}}</td>
        <td>{{default this.notes "None"}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
{{/with}}
{{else}}
  <p>No health conditions reported</p>
{{/if}}`}</code>
      </pre>
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-2">
        <p className="text-sm">
          <strong>⚠️ Important:</strong> When working with objects in arrays (like accessing <code>this.name</code>, <code>this.price</code>), 
          wrap your array in <code>{`{{#with (parseJSON arrayName)}}`}</code> first if the data is stored as a JSON string.
        </p>
      </div>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">4. Multiple Conditionals in Sequence</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto">
        <code>{`<div class="guest-info">
  {{#if guest_name}}
    <h2>{{guest_name}}</h2>
  {{/if}}
  
  {{#if (isNotEmpty dietary_requirements)}}
    <p><strong>Dietary:</strong> {{join dietary_requirements ", "}}</p>
  {{/if}}
  
  {{#if has_assistance_animal}}
    <p>⚠️ Guest traveling with assistance animal</p>
  {{/if}}
  
  {{#if (isArray mobility_equipment)}}
    <p><strong>Equipment:</strong></p>
    <ul>
      {{#each mobility_equipment}}
        <li>{{this}}</li>
      {{/each}}
    </ul>
  {{/if}}
</div>`}</code>
      </pre>
    </div>

    <div className="bg-gray-50 p-4 rounded-lg mt-4">
      <h3 className="font-semibold mb-2">5. Nested Conditionals with Formatting</h3>
      <pre className="bg-white p-3 rounded overflow-x-auto text-xs">
        <code>{`{{#if booking_type}}
  {{#if (eq booking_type "respite")}}
    <div class="respite-info">
      <h3>Respite Booking Details</h3>
      {{#if (isNotEmpty support_needs)}}
        <ul>
          {{#each support_needs}}
            <li>{{this}}</li>
          {{/each}}
        </ul>
      {{/if}}
    </div>
  {{else if (eq booking_type "course")}}
    <div class="course-info">
      <h3>Course Booking</h3>
      <p>Course: {{course_name}}</p>
      {{#if course_dates}}
        <p>Dates: {{join course_dates ", "}}</p>
      {{/if}}
    </div>
  {{/if}}
{{/if}}`}</code>
      </pre>
    </div>
  </div>
);

// All Helpers Tab Content
const AllHelpersContent = () => (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Complete Helper Reference</h2>
    
    {/* Date Helpers */}
    <div className="border-l-4 border-green-500 pl-4">
      <h3 className="font-semibold text-lg mb-2">📅 Date Helpers</h3>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Helper</th>
            <th className="px-4 py-2 text-left">Usage</th>
            <th className="px-4 py-2 text-left">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-4 py-2"><code>formatDate</code></td>
            <td className="px-4 py-2"><code>{`{{formatDate date "format"}}`}</code></td>
            <td className="px-4 py-2"><code>{`{{formatDate checkin_date "DD/MM/YYYY"}}`}</code></td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-gray-600 mt-2">
        Format strings: DD/MM/YYYY, MMMM DD YYYY, DD-MM-YY, etc.
      </p>
    </div>

    {/* Conditional Helpers */}
    <div className="border-l-4 border-blue-500 pl-4 mt-6">
      <h3 className="font-semibold text-lg mb-2">🔀 Conditional Helpers</h3>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Helper</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-left">Usage</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-4 py-2"><code>eq</code></td>
            <td className="px-4 py-2">Equals</td>
            <td className="px-4 py-2"><code>{`{{#if (eq a b)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>ne</code></td>
            <td className="px-4 py-2">Not equals</td>
            <td className="px-4 py-2"><code>{`{{#if (ne a b)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>gt</code></td>
            <td className="px-4 py-2">Greater than</td>
            <td className="px-4 py-2"><code>{`{{#if (gt a b)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>lt</code></td>
            <td className="px-4 py-2">Less than</td>
            <td className="px-4 py-2"><code>{`{{#if (lt a b)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>gte</code></td>
            <td className="px-4 py-2">Greater/equal</td>
            <td className="px-4 py-2"><code>{`{{#if (gte a b)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>lte</code></td>
            <td className="px-4 py-2">Less/equal</td>
            <td className="px-4 py-2"><code>{`{{#if (lte a b)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>or</code></td>
            <td className="px-4 py-2">Any true</td>
            <td className="px-4 py-2"><code>{`{{#if (or a b c)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>and</code></td>
            <td className="px-4 py-2">All true</td>
            <td className="px-4 py-2"><code>{`{{#if (and a b)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>not</code></td>
            <td className="px-4 py-2">Negation</td>
            <td className="px-4 py-2"><code>{`{{#if (not value)}}`}</code></td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* String Helpers */}
    <div className="border-l-4 border-purple-500 pl-4 mt-6">
      <h3 className="font-semibold text-lg mb-2">📝 String Helpers</h3>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Helper</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-left">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-4 py-2"><code>uppercase</code></td>
            <td className="px-4 py-2">Convert to UPPERCASE</td>
            <td className="px-4 py-2"><code>{`{{uppercase name}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>lowercase</code></td>
            <td className="px-4 py-2">Convert to lowercase</td>
            <td className="px-4 py-2"><code>{`{{lowercase name}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>capitalize</code></td>
            <td className="px-4 py-2">Capitalize first letter</td>
            <td className="px-4 py-2"><code>{`{{capitalize word}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>trim</code></td>
            <td className="px-4 py-2">Remove whitespace</td>
            <td className="px-4 py-2"><code>{`{{trim text}}`}</code></td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Array Helpers */}
    <div className="border-l-4 border-orange-500 pl-4 mt-6">
      <h3 className="font-semibold text-lg mb-2">📋 Array Helpers</h3>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Helper</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-left">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-4 py-2"><code>length</code></td>
            <td className="px-4 py-2">Get array length</td>
            <td className="px-4 py-2"><code>{`{{length items}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>isArray</code></td>
            <td className="px-4 py-2">Check if is array</td>
            <td className="px-4 py-2"><code>{`{{#if (isArray val)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>isEmpty</code></td>
            <td className="px-4 py-2">Check if empty</td>
            <td className="px-4 py-2"><code>{`{{#if (isEmpty arr)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>isNotEmpty</code></td>
            <td className="px-4 py-2">Check if has items</td>
            <td className="px-4 py-2"><code>{`{{#if (isNotEmpty arr)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>join</code></td>
            <td className="px-4 py-2">Join with separator</td>
            <td className="px-4 py-2"><code>{`{{join items ", "}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>first</code></td>
            <td className="px-4 py-2">Get first item</td>
            <td className="px-4 py-2"><code>{`{{first items}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>last</code></td>
            <td className="px-4 py-2">Get last item</td>
            <td className="px-4 py-2"><code>{`{{last items}}`}</code></td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Object Helpers */}
    <div className="border-l-4 border-red-500 pl-4 mt-6">
      <h3 className="font-semibold text-lg mb-2">🔑 Object Helpers</h3>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Helper</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-left">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-4 py-2"><code>keys</code></td>
            <td className="px-4 py-2">Get object keys</td>
            <td className="px-4 py-2"><code>{`{{keys object}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>values</code></td>
            <td className="px-4 py-2">Get object values</td>
            <td className="px-4 py-2"><code>{`{{values object}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>parseJSON</code></td>
            <td className="px-4 py-2">Parse JSON string</td>
            <td className="px-4 py-2"><code>{`{{parseJSON jsonStr}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>isObject</code></td>
            <td className="px-4 py-2">Check if is object</td>
            <td className="px-4 py-2"><code>{`{{#if (isObject val)}}`}</code></td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Math Helpers */}
    <div className="border-l-4 border-teal-500 pl-4 mt-6">
      <h3 className="font-semibold text-lg mb-2">🔢 Math Helpers</h3>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Helper</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-left">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-4 py-2"><code>add</code></td>
            <td className="px-4 py-2">Add numbers</td>
            <td className="px-4 py-2"><code>{`{{add a b}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>subtract</code></td>
            <td className="px-4 py-2">Subtract numbers</td>
            <td className="px-4 py-2"><code>{`{{subtract a b}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>multiply</code></td>
            <td className="px-4 py-2">Multiply numbers</td>
            <td className="px-4 py-2"><code>{`{{multiply a b}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>divide</code></td>
            <td className="px-4 py-2">Divide numbers</td>
            <td className="px-4 py-2"><code>{`{{divide a b}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>inc</code></td>
            <td className="px-4 py-2">Increment by 1</td>
            <td className="px-4 py-2"><code>{`{{inc @index}}`}</code></td>
          </tr>
        </tbody>
      </table>
    </div>

    {/* Type Checking Helpers */}
    <div className="border-l-4 border-indigo-500 pl-4 mt-6">
      <h3 className="font-semibold text-lg mb-2">✔️ Type Checking Helpers</h3>
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Helper</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-left">Example</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-4 py-2"><code>isString</code></td>
            <td className="px-4 py-2">Check if string</td>
            <td className="px-4 py-2"><code>{`{{#if (isString val)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>isNumber</code></td>
            <td className="px-4 py-2">Check if number</td>
            <td className="px-4 py-2"><code>{`{{#if (isNumber val)}}`}</code></td>
          </tr>
          <tr className="border-b">
            <td className="px-4 py-2"><code>default</code></td>
            <td className="px-4 py-2">Fallback value</td>
            <td className="px-4 py-2"><code>{`{{default val "N/A"}}`}</code></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

export default TemplateHelperDocumentation;